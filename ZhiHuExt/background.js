"use strict"
//import { Dexie } from "./dexie.min.js"

async function toNameMap(prop)
{
    const result = {};
    await this.each(obj => result[obj[prop]] = obj);
    return result;
}
async function toPropMap(keyProp, valProp)
{
    const result = {};
    await this.each(obj => result[obj[keyProp]] = obj[valProp]);
    return result;
}
Dexie.addons.push(x => x.Collection.prototype.toNameMap = toNameMap);
Dexie.addons.push(x => x.Collection.prototype.toPropMap = toPropMap);


const db = new Dexie("ZhihuDB2");
let BAN_UID = new Set();
let SPAM_UID = new Set();

db.version(1).stores(
    {
        spams: "id,type",
        users: "id,status,anscnt,followcnt",
        follows: "[from+to],from,to",
        zans: "[from+to],from,to,time",
        zanarts: "[from+to],from,to,time",
        answers: "id,author,question",
        questions: "id",
        articles: "id,author",
        topics: "id"
    });
db.spams.hook("creating", (primKey, obj, trans) =>
{
    if (obj.type === "member")
        SPAM_UID.add(obj.id);
});
db.users.hook("creating", (primKey, obj, trans) =>
{
    if (obj.status === null)
        obj.status = "";
    else if (obj.status === "ban" || obj.status === "sban")
        BAN_UID.add(obj.id);
});
db.users.hook("updating", (mods, primKey, obj, trans) =>
{
    const keys = Object.keys(mods);
    if (keys.length === 0) return;
    const ret = {};
    {
        if (mods.status === "ban" || mods.status === "sban")
            BAN_UID.add(obj.id);
        else if (mods.status === "")
            BAN_UID.delete(obj.id);
    }
    for (let idx = 0; idx < keys.length; idx++)
    {
        const key = keys[idx], val = mods[key];
        if ((val === -1 || val === null))
            if (obj.hasOwnProperty(key))
                ret[key] = obj[key];//skip unset values
    }
    //console.log("compare", mods, ret);
    return ret;
});
db.zans.hook("updating", (mods, primKey, obj, trans) =>
{
    if (mods.time === -1)
        return { time: obj.time };//skip empty time
    return;
});
db.zanarts.hook("updating", (mods, primKey, obj, trans) =>
{
    if (mods.time === -1)
        return { time: obj.time };//skip empty time
    return;
});
db.articles.hook("updating", (mods, primKey, obj, trans) =>
{
    const keys = Object.keys(mods);
    if (keys.length === 0) return;
    const ret = {};
    for (let idx = 0; idx < keys.length; idx++)
    {
        const key = keys[idx], val = mods[key];
        if ((val === -1 || val === null))
            if (obj.hasOwnProperty(key))
                ret[key] = obj[key];//skip unset values
    }
    return ret;
});
db.answers.hook("updating", (mods, primKey, obj, trans) =>
{
    const keys = Object.keys(mods);
    if (keys.length === 0) return;
    const ret = {};
    for (let idx = 0; idx < keys.length; idx++)
    {
        const key = keys[idx], val = mods[key];
        if ((val === -1 || val === null))
            if (obj.hasOwnProperty(key))
                ret[key] = obj[key];//skip unset values
    }
    return ret;
});
db.questions.hook("creating", (primKey, obj, trans) =>
{
    if (obj.topics === null)
        obj.topics = [];
});
db.questions.hook("updating", (mods, primKey, obj, trans) =>
{
    const hasModTopic = Object.keys(mods).find(key => key.startsWith("topics."));
    if (!mods.topics && !hasModTopic)
        return { topics: obj.topics };
});
db.open()
    .then(async () =>
    {
        console.log("initializing reading");
        const loader = [db.users.where("status").anyOf(["ban", "sban"]).primaryKeys(), db.spams.where("type").equals("member").primaryKeys()];
        const [ban, spam] = await Promise.all(loader);
        BAN_UID = new Set(ban);
        SPAM_UID = new Set(spam);
        console.log("readed", "BAN_UID:" + BAN_UID.size, "SPAM_UID:" + SPAM_UID.size);
    })
    .catch(e => console.error("cannot open db", e));


let TIMER_CLEAR_BADGE = setTimeout(clearBadge, 0);
/**@param {number} num */
function putBadge(num)
{
    clearTimeout(TIMER_CLEAR_BADGE);
    chrome.browserAction.setBadgeText({ text: "" + num });
    TIMER_CLEAR_BADGE = setTimeout(clearBadge, 500);
}
function clearBadge()
{
    chrome.browserAction.setBadgeText({ text: "" });
}


/**@param {number | string} tid */
function fetchTopic(tid)
{
    $.ajax("https://www.zhihu.com/api/v4/topics/" + tid, { type: "GET" })
        .done(data =>
        {
            const topic = new Topic(data.id, data.name);
            insertDB("topics", topic);
        });
}

/**
 * @param {string} target
 * @param {object | object[]} data
 * @param {boolean} [notify]
 */
function insertDB(target, data, notify)
{
    if (target === "batch")
    {
        let sum = 0;
        Object.entries(data).forEach(([key, val]) => sum += insertDB(key, val));
        if (notify)
            putBadge(sum);
        return sum;
    }

    const table = db[target];
    if (!table)
    {
        console.warn("unknown table", target, data);
        return 0;
    }
    let pms;
    let count = 0;
    if (!(data instanceof Array))
    {
        pms = table.put(data);
    }
    else if (data.length > 0)
    {
        count = data.length;
        pms = table.bulkPut(data);
    }
    else
        return 0;
    pms.catch(error => console.warn("[insert] failed!", error, target, data));
    if (notify)
        putBadge(count);
    return count;
}
/**
 * @param {string} target
 * @param {{obj: object | object[], key: string, updator: object}} data
 */
function updateDB(target, data)
{
    const table = db[target];
    if (!table)
        return false;
    console.log(target, data);
    let matchs;
    if (data.obj instanceof Array)
        matchs = table.where(data.key).anyOf(data.obj);
    else
        matchs = table.where(data.key).equals(data.obj);
    matchs.modify(match => Object.assign(match, data.updator))
        .catch(error => console.warn("[update] failed!", error, target, data));
    return true;
}
function countDB()
{
    const pms = $.Deferred();
    db.transaction("r", db.tables, () =>
    {
        const ret = { ban: BAN_UID.size };
        /**@type {Promise<void>[]}*/
        const tabpmss = db.tables.map(async table =>
        {
            ret[table.name] = await table.count();
            console.log("table counted", table.name);
        });
        Promise.all(tabpmss)
            .then(() => pms.resolve(ret))
            .catch(e => pms.reject(e));
    });
    return pms;
}
function exportDB()
{
    const pms = $.Deferred();
    db.transaction("r", db.tables, () =>
    {
        const ret = {};
        const tabpmss = db.tables.map(async table =>
        {
            ret[table.name] = await table.toArray();
            console.log("export table [" + table.name + "] success");
            return ret;
        });
        Promise.all(tabpmss)
            .then(tabs => pms.resolve(tabs))
            .catch(e => pms.reject(e));
    });
    return pms;
}
/**
 * @param {string} table
 * @param {number} from
 * @param {number} count
 * @returns {Promise<string> | Promise<string[]>}
 */
async function partDB(table, from, count)
{
    if (table == null)
        return db.tables.mapToProp("name");
    return JSON.stringify(await db[table].offset(from).limit(count).toArray());
}

/**
 * @param {string[] | User[]} waitUsers
 */
async function checkSpamUser(waitUsers)
{
    const ret = { banned: [], spamed: [] };
    const ids = (typeof(waitUsers[0]) === "string") ? waitUsers : waitUsers.mapToProp("id");
    const [bannedPart, unbannedPart] = splitInOutSide(ids, BAN_UID);
    ret.banned = bannedPart;

    const [spamedIds, dummy] = await splitInOutSide(unbannedPart, SPAM_UID);
    ret.spamed = spamedIds;
    return ret;
}

/**
 * @param {"answer" | "article"} target
 * @param {number | string} id
 */
async function checkUserSimilarity(target, id)
{
    const theid = Number(id);
    const voters = target === "answer" ? await Analyse.getAnsVoters(theid) : await Analyse.getArtVoters(theid);
    const result = await Analyse.findUserSimilarityInVote(voters);
    return result;
}

const MONITOR_TABS = new Set();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) =>
{
    switch (request.action)
    {
        case "stat":
            countDB().then(result =>
            {
                console.log("statics result:", result);
                sendResponse(result);
            });
            return true;
        case "chkspam":
            {
                checkSpamUser(request.data)
                    .then(result =>
                    {
                        console.log("check-spam result:", result);
                        sendResponse(result);
                    });
            } return true;
        case "chksim":
            {
                checkUserSimilarity(request.target, request.data)
                    .then(res => sendResponse(res), err => console.warn(err));
            } return true;
        case "export":
            exportDB().done(dbjson =>
            {
                const blob = new Blob([JSON.stringify(dbjson)], { type: "application/json" });
                const time = new Date().Format("yyyyMMdd-hhmm");
                const fname = "ZhiHuExtDB-" + time + ".json";
                DownloadMan.download(blob, fname);
            }).fail(error => console.warn("exportDB fail", error));
            break;
        case "partdb":
            partDB(request.target, request.from, request.count)
                .then(part => sendResponse(part), err => console.warn(err));
            return true;
        case "insert":
            insertDB(request.target, request.data, true);
            break;
        case "update":
            if (!updateDB(request.target, request.data))
                console.warn("update wrong", request);
            break;
        case "openpage":
            chrome.tabs.create({ active: !request.isBackground, url: request.target });
            break;
        case "analyse":
            {
                const fn = Analyse[request.method];
                if (fn)
                {
                    fn(...request.argument).then(
                        ret => sendResponse(ret),
                        error => console.warn("calling analyse fail", error));
                }
                else
                    break;
            } return true;
        //case "regist":
        //    {
        //        MONITOR_TABS.add(sender.tab.id);
        //        const debuggee = { tabId: sender.tab.id };
        //        chrome.debugger.attach(debuggee, "1.2", () =>
        //        {
        //            console.log("debugger attach:", "tab: ", sender.tab.id, "url: ", request.url);
        //            chrome.debugger.sendCommand(debuggee, "Network.enable");
        //        });
        //    }
        default:
            console.log("unknown action:" + request.action, request);
            break;
    }
});
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) =>
{
    const data = JSON.parse(request.data);
    switch (request.target)
    {
        case "activities":
            {
                const res = APIParser.parsePureActivities(data.data);
                insertDB("batch", res, true);
                console.log(request.target, res);
            } break;
        case "answers":
        case "questions":
            {
                const res = APIParser.SumType();
                data.data.forEach(act => APIParser.parseByType(res, act));
                insertDB("batch", res, true);
                console.log(request.target, res);
            } break;
        case "relations":
            {
                const users = data.data.map(User.fromRawJson);
                insertDB("users", users, true);
                console.log(request.target, users);
            } break;
        case "empty":
            {
                const user = User.fromRawJson(data);
                insertDB("users", user, true);
                console.log("user", user);
            } break;
        case "publications":
            break;
        default:
            console.log("unknown-extern", request.target, request.url, data);
    }
});

$(document).ready(function ()
{
    new Clipboard('#copyBtn');
});


//const REQ_IDS = new Set();
//chrome.debugger.onEvent.addListener((source, method, params) =>
//{
//    if (!MONITOR_TABS.has(source.tabId))
//        return;
//    switch (method)
//    {
//        case "Network.requestWillBeSent":
//            {
//                /**@type {string}*/
//                const url = params.documentURL;
//                const reqId = params.requestId;
//                if (url.includes("www.zhihu.com/api/v4/members/"))
//                {
//                    console.info("request", reqId, url);
//                    REQ_IDS.add(reqId);
//                }
//            }
//        case "Network.loadingFinished":
//            {
//                const reqId = params.requestId;
//                console.info("loaded", reqId, REQ_IDS.has(reqId));
//                REQ_IDS.delete(reqId);
//            } break;
//        default:
//            console.info(method, params);
//    }
//});

//chrome.webRequest.onCompleted.addListener(details =>
//{

//}, { urls: ["*://www.zhihu.com/api/v4/members/*/activities*"] });


