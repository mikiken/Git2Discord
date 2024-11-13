const SCHEDULE_JSON_URL = PropertiesService.getScriptProperties().getProperty("SCHEDULE_JSON_URL");
const USER_ID = PropertiesService.getScriptProperties().getProperty("USER_ID");
const PASSWORD = PropertiesService.getScriptProperties().getProperty("PASSWORD");

const DISCORD_WEBHOOK_URL = PropertiesService.getScriptProperties().getProperty("DISCORD_WEBHOOK_URL");

const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
const SHEET_NAME = PropertiesService.getScriptProperties().getProperty("SHEET_NAME");

function main() {
    // 今日の予定を取得
    let todayEntries = getTodayEntries();
    // 各予定をDiscordに通知
    todayEntries.forEach((entry) => {
        let message = formatMessageForDiscord(entry);
        postWebhook(DISCORD_WEBHOOK_URL, message);
    });
    // 翌日のトリガーをセット
    setNextTrigger('main');
}

function getTodayEntries() {
    // scheduleのJSONを取得
    let schedule_json = UrlFetchApp.fetch(SCHEDULE_JSON_URL, {
        "method": "GET",
        "headers": { "Authorization": " Basic " + Utilities.base64Encode(USER_ID + ":" + PASSWORD) },
        "muteHttpExceptions": true
    });

    // scheduleのJSONのうち、今日の日付のものを取得
    let todayEntries = JSON.parse(schedule_json).filter(function (entry) {
        if (entry.start.startsWith(new Date().toLocaleDateString('sv-SE'))) { return true; }
    });
    return todayEntries;
}

function formatMessageForDiscord(todaySchedule) {
    // JSONから各フィールドを取得
    let start = todaySchedule['start'];
    let end = todaySchedule['end'];
    let url = todaySchedule['url'];
    let title = replaceMentionForDiscord(todaySchedule['title']);

    let month = new Date().getMonth() + 1;
    let day = new Date().getDate();
    let start_time = new Date(start).toLocaleTimeString('it-IT').slice(0, 5); // 開始時刻をHH:MM形式のStringとして取得
    let end_time = new Date(end).toLocaleTimeString('it-IT').slice(0, 5);     // 終了時刻をHH:MM形式のStringとして取得

    let content = (function () {
        if (title == "Closed") {
            return "今日の予定はありません";
        } else {
            if (url)
                return `${month}/${day}  ${start_time} ~ ${end_time}  ${title}\n${url}`;
            else
                return `${month}/${day}  ${start_time} ~ ${end_time}  ${title}`;
        }
    })();

    return {
        username: "schedule bot",
        content: `${content}`,
    };
}

// GitHubのメンションをDiscordのメンションに置換する
function replaceMentionForDiscord(message) {
    // スプレッドシートからユーザーの対応表を取得
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    const table = sheet.getDataRange().getValues();

    for (let i = 0; i < table.length; i++) {
        const githubUserName = table[i][0];
        const discordUserId = table[i][1];
        // メッセージにメンションを含む場合、DiscordのUserIDに置換
        if (message.includes("@" + githubUserName)) {
            message = message.replace(new RegExp("@" + githubUserName, 'g'), "<@" + discordUserId + ">");
        }
    }
    return message;
}

function postWebhook(webhook_url, payload) {
    UrlFetchApp.fetch(webhook_url, {
        contentType: 'application/json',
        method: 'post',
        payload: JSON.stringify(payload)
    });
}

function setNextTrigger(function_name) {
    // 過去のトリガーを削除
    let triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((trigger) => {
        let triggered_function = trigger.getHandlerFunction();
        if (triggered_function == function_name) {
            ScriptApp.deleteTrigger(trigger);
        }
    });

    // 翌日00:00にトリガーをセット
    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();
    let next_trigger_date = new Date(year, month, day + 1, 0, 0);
    ScriptApp.newTrigger(function_name).timeBased().at(next_trigger_date).create();
}
