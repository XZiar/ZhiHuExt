"use strict"

const auth = "fwAAASLR" + "171115a";

function directSend(table, offset, count, addr, id)
{
    const sending = { headers: { "objid": id, "authval": auth }, url: addr + "/accept?table=" + table }
    return SendMsgAsync({ action: "partdb", target: table, from: offset, count: count, sending: sending });
}


/**
 * @param {string} table
 * @param {string} addr
 * @param {string} id
 * @param {number} offset
 * @param {number} count
 * @returns {Promise<string>}
 */
function receivepart(table, addr, id, offset, count)
{
    const pms = $.Deferred();
    $.ajax(`${addr}/accept?table=${table}&from=${offset}&limit=${count}`,
        {
            type: "GET",
            headers: { "objid": id, "authval": auth },
        })
        .done(x => pms.resolve(x))
        .fail(err => pms.reject(err));
    return pms;
}

function begin(addr, id)
{
    const pms = $.Deferred();
    $.ajax(addr + "/begin",
        {
            type: "GET",
            headers: { "objid": id, "authval": auth }
        })
        .done(x => pms.resolve())
        .fail(err => pms.reject(err));
    return pms;
}

function finish(addr, id, extra)
{
    const pms = $.Deferred();
    $.ajax(addr + "/finish" + (extra ? "?" + extra : ""),
        {
            type: "GET",
            headers: { "objid": id, "authval": auth }
        })
        .done(x => pms.resolve())
        .fail(err => pms.reject(err));
    return pms;
}


/**
 * @param {string[]} tables
 * @param {number} partlen
 * @param {string} addr
 * @param {function(string, number):void} onProgress
 */
async function send(tables, partlen, addr, onProgress)
{
    const timeid = new Date().Format("yyyyMMdd-hhmm");
    console.log(timeid, "addr", addr, "tables", tables, "len", partlen);
    await begin(addr, timeid);
    for (let i = 0; i < tables.length; ++i)
    {
        let offset = 0;
        const tabname = tables[i];
        let len = partlen;
        if (tabname === "zans" || tabname === "zanarts")
            len *= 2;
        else if (tabname === "articles" || tabname === "answers")
            len = Math.floor(len / 2);
        else if (tabname === "details")
            len = Math.floor(len / 50);
        let last = undefined;
        while (true)
        {
            const sending = { headers: { "objid": timeid, "authval": auth }, url: addr + "/accept?table=" + tabname };
            const ret = await SendMsgAsync({ action: "partdb", target: tabname, from: last, count: len, sending: sending });
            if (ret instanceof Array && ret.length === 0)
                break;
            if (ret === "false")
                throw { err: "unknown err" };
            if (onProgress)
                onProgress(tabname, offset);
            offset += len;
            if (tabname === "zans" || tabname === "zanarts" || tabname === "follows")
                last = [ret.from, ret.to];
            else
                last = ret.id;
        }
    }
    const extra = {};
    extra.noexcerpt = $("#slimExcerpt")[0].checked ? "true" : "false";
    extra.notime = $("#slimTime")[0].checked ? "true" : "false";
    await finish(addr, timeid, _toQueryString(extra));
}

/**
    * @param {any[]} objs
    */
function quickfix(objs)
{
    objs.forEach(obj =>
    {
        if (obj.topics != null && obj.topics.length === 0)
            obj.topics = null;
        if (obj.excerpt === "")
            obj.excerpt = null;
        if (obj.status === "")
            obj.status = null;
    });
}

/**
 * @param {string[]} tables
 * @param {string} timeid
 * @param {number} partlen
 * @param {string} addr
 * @param {function(string, number):void} onProgress
 */
async function receive(tables, timeid, partlen, addr, onProgress)
{
    console.log(timeid, "addr", addr, "tables", tables, "len", partlen);
    await begin(addr, timeid);
    for (let i = 0; i < tables.length; ++i)
    {
        let offset = 0;
        while (true)
        {
            const pms = receivepart(tables[i], addr, timeid, offset, partlen);
            if (onProgress)
                onProgress(tables[i], offset);
            const part = await pms;
            if (part === "[]")
                break;
            const partobj = JSON.parse(part);
            quickfix(partobj);
            console.log(partobj);

            chrome.runtime.sendMessage({ action: "insert", target: tables[i], data: partobj });

            offset += partlen;
        }
    }
    await finish(addr, timeid);
}

let tables;
!async function()
{
    tables = await SendMsgAsync({ "action": "partdb" });
    console.log(tables);
    const tbody = document.querySelector("#maintable").querySelector("tbody");
    const rows = tables.map(tname => `<tr><td>${tname}<input type="checkbox" class="tabchooser" data-tname="${tname}" checked/></td><tr>`)
        .join("");
    tbody.innerHTML = rows;
}()


$(document).on("click", "button#quickexport", () =>
{
    chrome.runtime.sendMessage({ action: "export" });
});
$(document).on("click", "button#quickimport", e =>
{
    const btn = e.target;
    const files = $("#infile")[0].files;
    if (files.length <= 0)
        return;
    const reader = new FileReader();
    reader.onload = e =>
    {
        const content = e.target.result;
        const report = JSON.parse(content);
        const ks = Object.keys(report);
        if (ks.length !== 1 || ks[0] !== "rectime")
        {
            delete report.rectime;
            quickfix(report.questions);
            quickfix(report.answers);
            quickfix(report.articles);
            quickfix(report.users);
        }
        console.log(report);
        ContentBase._report("batch", report);
    }
    reader.readAsText(files[0]);
});
$(document).on("click", "button#send", async (e) =>
{
    /**@type {HTMLButtonElement}*/
    const thisbtn = e.target;
    const partlen = Number($("#partlen")[0].value);
    const ip = $("#ip")[0].value;
    const port = $("#port")[0].value;
    const addr = `http://${ip}:${port}/export`;
    const needtables = $(".tabchooser").toArray()
        .filter(/**@type {HTMLInputElement}*/(chkbox) => chkbox.checked)
        .map(chkbox => chkbox.dataset.tname);
    try
    {
        await send(needtables, partlen, addr, (tab, cnt) => { thisbtn.textContent = tab + "@" + cnt; });
        thisbtn.textContent = "开始发送";
        thisbtn.style.backgroundColor = "rgb(0,224,32)";
    }
    catch (e)
    {
        console.warn(e);
        thisbtn.style.backgroundColor = "rgb(224,0,32)";
    }
});

$(document).on("click", "button#receive", async (e) =>
{
    /**@type {HTMLButtonElement}*/
    const thisbtn = e.target;
    const partlen = Number($("#partlen")[0].value);
    const ip = $("#ip")[0].value;
    const port = $("#port")[0].value;
    const suffix = $("#suffix")[0].value;
    const addr = `http://${ip}:${port}/import`;
    const needtables = $(".tabchooser").toArray()
        .filter(/**@type {HTMLInputElement}*/(chkbox) => chkbox.checked)
        .map(chkbox => chkbox.dataset.tname);
    try
    {
        await receive(needtables, suffix, partlen, addr, (tab, cnt) => { thisbtn.textContent = tab + "@" + cnt; });
        thisbtn.textContent = "开始接收";
        thisbtn.style.backgroundColor = "rgb(0,224,32)";
    }
    catch (e)
    {
        console.warn(e);
        thisbtn.style.backgroundColor = "rgb(224,0,32)";
    }
})

