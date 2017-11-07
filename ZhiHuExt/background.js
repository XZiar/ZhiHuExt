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

const db2 = new Dexie("ZhihuDB");
const db = new Dexie("ZhihuDB2");
let BAN_UID = new Set();
let SPAM_UID = new Set();

db2.version(1).stores(
    {
        spams: "id,type",
        users: "id,status,anscnt,followcnt",
        follows: "[from+to],from,to",
        zans: "[from+to],from,to",
        answers: "id,author,question",
        questions: "id",
        topics: "id"
    });
db2.version(2).stores(
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
    })
    .upgrade(trans =>
    {
        console.log("begin update");
        trans.zans.toCollection().modify(zan =>
        {
            if (zan.time == null)
                zan.time = -1;
        });
    });

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
db2.open();
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
    if (mods.time === -1 && obj.hasOwnProperty("time"))
        return { time: obj.time };//skip empty time
    return;
});
db.zanarts.hook("updating", (mods, primKey, obj, trans) =>
{
    if (mods.time === -1 && obj.hasOwnProperty("time"))
        return { time: obj.time };//skip empty time
    return;
});
db.articles.hook("updating", (mods, primKey, obj, trans) =>
{
    const keys = Object.keys(mods);
    if (keys.length === 0) return;
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
        BAN_UID = new Set(await db.users.where("status").anyOf(["ban", "sban"])/*.equals("ban")*/.primaryKeys());
        SPAM_UID = new Set(await db.spams.where("type").equals("member").primaryKeys());
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
 */
function insertDB(target, data)
{
    const table = db[target];
    if (!table)
        return false;
    //console.log(target, data);
    let pms;
    if (!(data instanceof Array))
    {
        pms = table.put(data);
        putBadge(1);
    }
    else if (data.length > 0)
    {
        pms = table.bulkPut(data);
        putBadge(data.length);
    }
    else
        return false;
    pms.catch(error => console.warn("[insert] failed!", error, target, data));
    return true;
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
 * @param {string[] | object[]} waitUsers
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
                checkSpamUser(request.data instanceof Array ? request.data : [request.data])
                    .then(result =>
                    {
                        console.log("check-spam result:", result);
                        sendResponse(result);
                    });
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
        case "insert":
            if (request.target === "batch")
                Object.entries(request.data).forEach(([key, val]) =>
                {
                    if (!val || (val instanceof Array && val.length === 0))
                        return;
                    if (!insertDB(key, val))
                        console.warn("insert wrong", key, val);
                })
            else if (!insertDB(request.target, request.data))
                console.warn("insert wrong", request);
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
        case "hey":
            sendResponse("hi");
            break;
        default:
            console.log("unknown action:" + request.action, request);
            break;
    }
});
/*
const DOWNLOAD_QUEUE = {};
chrome.downloads.onChanged.addListener((delta) =>
{
    if (!DOWNLOAD_QUEUE.hasOwnProperty(delta.id))
        return;
    if (delta.state && delta.state.current === "complete")
    {
        const url = DOWNLOAD_QUEUE[delta.id];
        delete DOWNLOAD_QUEUE[delta.id];
        URL.revokeObjectURL(url);
        console.log("finish download [" + delta.id + "], revoke:", url);
    }
})
*/
$(document).ready(function ()
{
    new Clipboard('#copyBtn');
});

