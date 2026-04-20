/**
 * ============================================================
 * 🏆 КИБЕРТРОЕБОРЬЕ — Google Apps Script  (v2 — GET only)
 * ============================================================
 * Все запросы теперь идут через GET, чтобы не было CORS-проблем.
 *
 * Параметры запроса:
 *   ?action=getTeams              → вернуть все команды
 *   ?action=addTeam&data={...}    → добавить команду (JSON в data)
 *   ?action=deleteTeam&id=xxx     → удалить по id
 * ============================================================
 */

var SHEET_NAME = 'Команды';

// Плоские заголовки для таблицы (игроки 1-5)
var HEADERS = [
  'id', 'teamName', 'contact', 'wormix', 'registeredAt',
  'p1nick', 'p1dota', 'p1cs2',
  'p2nick', 'p2dota', 'p2cs2',
  'p3nick', 'p3dota', 'p3cs2',
  'p4nick', 'p4dota', 'p4cs2',
  'p5nick', 'p5dota', 'p5cs2',
];

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
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 150);
  }

  return sheet;
}

function corsOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// Единая точка входа — только doGet
// ============================================================
function doGet(e) {
  try {
    var action = e.parameter.action || 'getTeams';

    if (action === 'getTeams') {
      return handleGetTeams();
    } else if (action === 'addTeam') {
      var team = JSON.parse(e.parameter.data);
      return handleAddTeam(team);
    } else if (action === 'deleteTeam') {
      return handleDeleteTeam(e.parameter.id);
    } else {
      return corsOutput({ error: 'Неизвестный action: ' + action });
    }
  } catch (err) {
    return corsOutput({ error: err.toString() });
  }
}

// ============================================================
// Получить все команды
// ============================================================
function handleGetTeams() {
  var sheet = getSheet();
  var data  = sheet.getDataRange().getValues();

  if (data.length <= 1) return corsOutput([]);

  var headers = data[0];
  var teams   = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue; // пропуск пустых строк

    // Читаем базовые поля
    var team = {
      id:           (row[0] || '').toString(),
      teamName:     (row[1] || '').toString(),
      contact:      (row[2] || '').toString(),
      wormix:       (row[3] || '').toString(),
      registeredAt: (row[4] || '').toString(),
      players:      [],
    };

    // Читаем игроков (по 3 колонки: nick, dota, cs2)
    for (var p = 0; p < 5; p++) {
      var base = 5 + p * 3;
      var nick = (row[base]     || '').toString().trim();
      var dota = (row[base + 1] || '').toString().trim();
      var cs2  = (row[base + 2] || '').toString().trim();
      if (nick || dota || cs2) {
        team.players.push({ nick: nick, dota: dota, cs2: cs2 });
      }
    }

    teams.push(team);
  }

  return corsOutput(teams);
}

// ============================================================
// Добавить команду
// ============================================================
function handleAddTeam(team) {
  if (!team || !team.id || !team.teamName) {
    return corsOutput({ error: 'Неверные данные команды' });
  }

  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();

  // Проверка дублей по id
  if (lastRow > 1) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0].toString() === team.id.toString()) {
        return corsOutput({ success: true, duplicate: true });
      }
    }
  }

  // Собираем строку
  var players = team.players || [];
  var row = [
    team.id,
    team.teamName,
    team.contact || '',
    team.wormix  || '',
    team.registeredAt || new Date().toISOString(),
  ];

  // Добавляем данные по 5 игрокам (пустые, если игрока нет)
  for (var p = 0; p < 5; p++) {
    var pl = players[p] || {};
    row.push(pl.nick || '', pl.dota || '', pl.cs2 || '');
  }

  sheet.appendRow(row);
  return corsOutput({ success: true, team: team });
}

// ============================================================
// Удалить команду по id
// ============================================================
function handleDeleteTeam(id) {
  if (!id) return corsOutput({ error: 'ID не указан' });

  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) return corsOutput({ success: false, message: 'Таблица пустая' });

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (var i = ids.length - 1; i >= 0; i--) {
    if (ids[i][0].toString() === id.toString()) {
      sheet.deleteRow(i + 2);
      return corsOutput({ success: true, deletedId: id });
    }
  }

  return corsOutput({ success: false, message: 'Команда ' + id + ' не найдена' });
}

// Оставляем doPost как заглушку (на случай если что-то отправит POST)
function doPost(e) {
  return corsOutput({ error: 'POST не поддерживается. Используй GET с параметрами.' });
}
