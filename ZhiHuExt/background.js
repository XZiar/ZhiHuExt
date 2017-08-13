"use strict"

const db = new Dexie("ZhihuDB");
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
});
db.users.hook("updating", (mods, primKey, obj, trans) =>
{
    const keys = Object.keys(mods);
    if (keys.length === 0) return;
    const ret = {};
    for (let idx = 0; idx < keys.length; idx++)
    {
        const key = keys[idx], val = mods[key];
        if ((val === -1 || val === null))
            if(obj.hasOwnProperty(key))
                ret[key] = obj[key];//skip unset values
    }
    //console.log("compare", mods, ret);
    return ret;
});
db.open().catch(e => console.error("cannot open db", e));


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
        const ret = {};
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

function checkSpamUser(users)
{
    const ids = users.map(user => user.id);
    const spamsPms = db.spams.where("id").anyOf(ids)
        .filter(spam => spam.type == "member").primaryKeys();
    const pms = $.Deferred();
    spamsPms.then(uids =>
    {
        if (uids.length === 0)
        {
            pms.resolve([]);
            return;
        }
        db.users.where("id").anyOf(uids)
            .toArray(uss => pms.resolve(uss));
    })
    return pms;
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
            checkSpamUser(request.data instanceof Array ? request.data : [request.data])
                .then(result =>
                {
                    console.log("check-spam result:", result);
                    sendResponse(result);
                });
            return true;
        case "export":
            exportDB().done(dbjson =>
            {
                //console.log("export db outputs:", dbjson);
                const blob = new Blob([JSON.stringify(dbjson)], { type: "application/json" });
                const blobUrl = URL.createObjectURL(blob);
                console.log("export to:", blobUrl);
                chrome.downloads.download({ url: blobUrl, filename: "ZhiHuExtDB.json" }, did =>
                {
                    if (did === undefined)
                    { console.warn("download wrong", chrome.runtime.lastError); return; }
                    DOWNLOAD_QUEUE[did] = blobUrl;
                    console.log("start download [" + did + "]");
                });
            }).fail(error => console.warn("exportDB fail", error));
            break;
        case "insert":
            if (!insertDB(request.target, request.data))
                console.warn("insert wrong", request);
            break;
        case "update":
            if (!updateDB(request.target, request.data))
                console.warn("update wrong", request);
            break;
        default:
            console.log("unknown action:" + request.action, request);
            break;
    }
});

const DOWNLOAD_QUEUE = {}
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
