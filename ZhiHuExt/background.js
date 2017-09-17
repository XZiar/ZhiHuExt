"use strict"

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

const db = new Dexie("ZhihuDB");
let BAN_UID = new Set();

db.version(1).stores(
    {
        spams: "id,type",
        users: "id,status,anscnt,followcnt",
        follows: "[from+to],from,to",
        zans: "[from+to],from,to",
        answers: "id,author,question",
        questions: "id",
        topics: "id"
    })
    .upgrade(trans =>
    {
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
    .then(async () => { BAN_UID = new Set(await db.users.where("status").anyOf(["ban","sban"])/*.equals("ban")*/.primaryKeys()); })
    .catch(e => console.error("cannot open db", e));


let TIMER_CLEAR_BADGE = setTimeout(clearBadge, 0);
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


function fetchTopic(tid)
{
    $.ajax("https://www.zhihu.com/api/v4/topics/" + tid, { type: "GET" })
        .done(data =>
        {
            const topic = new Topic(data.id, data.name);
            insertDB("topics", topic);
        });
}

function getTargetTable(target)
{
    let table;
    switch (target)
    {
        case "spam":
            table = db.spams;
            break;
        case "users":
            table = db.users;
            break;
        case "follows":
            table = db.follows;
            break;
        case "zans":
            table = db.zans;
            break;
        case "answers":
            table = db.answers;
            break;
        case "questions":
            table = db.questions;
            break;
        case "topics":
            table = db.topics;
            break;
        default:
            console.warn("unknown target:" + target);
            break;
    }
    return table;
}
function insertDB(target, data)
{
    const table = getTargetTable(target);
    if (!table)
        return false;
    console.log(target, data);
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
function updateDB(target, data)
{
    const table = getTargetTable(target);
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
    db.transaction("r", ...db.tables, () =>
    {
        const ret = { ban: BAN_UID.size };
        const tabpmss = db.tables.map(async table =>
        {
            ret[table.name] = await table.count();
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
    db.transaction("r", ...db.tables, () =>
    {
        const tabpmss = db.tables.map(async table =>
        {
            const ret = {};
            ret[table.name] = await table.toArray();
            console.log("export table [" + table.name + "] success", ret);
            return ret;
        });
        Promise.all(tabpmss)
            .then(tabs => pms.resolve(tabs))
            .catch(e => pms.reject(e));
    });
    return pms;
}

function splitInOutSide(array, set)
{
    if (!(array instanceof Array) || !(set instanceof Set))
    {
        console.warn("argument wrong", array, set);
        return;
    }
    const inside = [], outside = [];
    for (let idx = 0; idx < array.length; ++idx)
    {
        let obj = array[idx];
        if (set.has(obj))
            inside.push(obj);
        else
            outside.push(obj);
    }
    return [inside, outside];
}
async function checkSpamUser(waitUsers)
{
    const ret = { banned: [], spamed: [] };
    const ids = waitUsers.mapToProp("id");
    const [bannedPart, unbannedPart] = splitInOutSide(ids, BAN_UID);
    ret.banned = await db.users.where("id").anyOf(bannedPart).toArray();

    const spamedIds = await db.spams.where("id").anyOf(unbannedPart)
        .filter(spam => spam.type == "member").primaryKeys();
    ret.spamed = await db.users.where("id").anyOf(spamedIds).toArray();
    return ret;
}
/*
function tmpk(data, filename)
{
    const pms = $.Deferred();
    const isBlob = data instanceof Blob;
    var url = isBlob ? URL.createObjectURL(data) : data;
    if (isBlob)
        console.log("export blob data to:", url);
    else if (!(data instanceof string))
    {
        console.warn("unknown data type", data);
        pms.reject("unknown data type:[" + typeof (data) + "]");
        return pms;
    }

    chrome.downloads.download({ url: url, filename: filename }, id =>
    {
        if (id === undefined)
        {
            const errMsg = chrome.runtime.lastError;
            console.warn("download wrong", errMsg);
            pms.reject(errMsg);
        }
        else
        {
            console.log("start download [" + id + "]");
            if (isBlob)
                DOWNLOAD_QUEUE[id] = url;
            pms.resolve(id);
        }
    });
    return pms;
}
*/
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
            }return true;
        case "export":
            exportDB().done(dbjson =>
            {
                //console.log("export db outputs:", dbjson);
                const blob = new Blob([JSON.stringify(dbjson)], { type: "application/json" });
                const blobUrl = URL.createObjectURL(blob);
                console.log("export to:", blobUrl);
                const time = new Date().Format("yyyyMMdd-hhmm");
                const fname = "ZhiHuExtDB-" + time + ".json";
                chrome.downloads.download({ url: blobUrl, filename: fname }, did =>
                {
                    if (did === undefined)
                    { console.warn("download wrong", chrome.runtime.lastError); return; }
                    DOWNLOAD_QUEUE[did] = blobUrl;
                    console.log("start download [" + did + "]");
                });
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
        default:
            console.log("unknown action:" + request.action, request);
            break;
    }
});

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

$(document).ready(function ()
{
    new Clipboard('#copyBtn');
});

//import Dexie from "./Dependency/dexie.js"
