/**
 * ============================================================
 * 🏆 КИБЕРТРОЕБОРЬЕ — Google Apps Script
 * ============================================================
 * Инструкция по установке:
 *   1. Открой Google Таблицу (или создай новую)
 *   2. Расширения → Apps Script
 *   3. Вставь весь этот код, нажми «Сохранить»
 *   4. Развернуть → Новое развёртывание → Тип: Веб-приложение
 *      Доступ: «Все» (анонимный)
 *   5. Скопируй URL вида https://script.google.com/macros/s/.../exec
 *   6. Вставь этот URL в src/App.jsx в переменную SCRIPT_URL
 * ============================================================
 */

// Имя листа в таблице (можно изменить)
var SHEET_NAME = 'Команды';

// Заголовки столбцов (создаются автоматически при первом запросе)
var HEADERS = ['id', 'name', 'dota', 'cs2', 'wormix', 'registeredAt'];

/**
 * Вспомогательная функция — получить/создать нужный лист
 */
function getSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#1a1a2e')
      .setFontColor('#00ff88');
    sheet.setFrozenRows(1);
  }

  // Убеждаемся, что заголовки есть (для старых листов)
  var firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (firstRow[0] !== 'id') {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  return sheet;
}

/**
 * Добавить CORS-заголовки в ответ
 */
function corsOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// GET /exec?action=getTeams
// Возвращает массив всех команд
// ============================================================
function doGet(e) {
  try {
    var sheet = getSheet();
    var data  = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      // Нет строк данных (только заголовки или пусто)
      return corsOutput([]);
    }

    var headers = data[0];
    var teams   = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      // Пропускаем пустые строки
      if (!row[0]) continue;
      var team = {};
      for (var j = 0; j < headers.length; j++) {
        team[headers[j]] = row[j] ? row[j].toString() : '';
      }
      teams.push(team);
    }

    return corsOutput(teams);

  } catch (err) {
    return corsOutput({ error: err.toString() });
  }
}

// ============================================================
// POST /exec
// Тело запроса: JSON { action: 'addTeam'|'deleteTeam', team?: {...}, id?: string }
// ============================================================
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;

    if (action === 'addTeam') {
      return handleAddTeam(payload.team);
    } else if (action === 'deleteTeam') {
      return handleDeleteTeam(payload.id);
    } else {
      return corsOutput({ error: 'Неизвестный action: ' + action });
    }

  } catch (err) {
    return corsOutput({ error: err.toString() });
  }
}

/**
 * Добавить новую команду в таблицу
 */
function handleAddTeam(team) {
  if (!team || !team.id || !team.name) {
    return corsOutput({ error: 'Неверные данные команды' });
  }

  var sheet = getSheet();

  // Проверка на дублирование по id
  var ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === team.id) {
      return corsOutput({ success: true, duplicate: true });
    }
  }

  var newRow = HEADERS.map(function(h) { return team[h] || ''; });
  sheet.appendRow(newRow);

  return corsOutput({ success: true, team: team });
}

/**
 * Удалить команду по id
 */
function handleDeleteTeam(id) {
  if (!id) return corsOutput({ error: 'ID не указан' });

  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return corsOutput({ success: false, message: 'Таблица пустая' });
  }

  var idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (var i = idColumn.length - 1; i >= 0; i--) {
    if (idColumn[i][0].toString() === id.toString()) {
      sheet.deleteRow(i + 2); // +2: заголовок (1) + 0-based (1)
      return corsOutput({ success: true, deletedId: id });
    }
  }

  return corsOutput({ success: false, message: 'Команда с id=' + id + ' не найдена' });
}
