"use strict"

!async function ()
{
    const auth = "fwAAASLR" + "171115a";
    /**
     * @param {string} table
     * @param {number} offset
     * @param {number} count
     * @returns {Promise<string>}
     */
    function fetchdb(table, offset, count)
    {
        return SendMsgAsync({ action: "partdb", target: table, from: offset, count: count });
    }

    /**
     * @param {string} table
     * @param {string} data
     * @param {string} addr
     * @param {string} id
     * @returns {Promise<void>}
     */
    function sendpart(table, data, addr, id)
    {
        const pms = $.Deferred();
        $.ajax(addr + "/accept?table=" + table,
            {
                type: "POST",
                headers: { "objid": id, "authval": auth },
                contentType: "application/json",
                data: data
            })
            .done(x => pms.resolve())
            .fail(err => pms.reject(err));
        return pms;
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
            const len = (tabname === "zans" || tabname === "zanarts") ? partlen * 3 : partlen;
            while (true)
            {
                const parturl = await fetchdb(tabname, offset, len);
                const part = await (await fetch(parturl)).text();
                URL.revokeObjectURL(parturl);
                if (part === "[]")
                    break;
                const pms = sendpart(tabname, part, addr, timeid);
                if (onProgress)
                    onProgress(tabname, offset);
                offset += len;
                await pms;
            }
        }
        shouldSlim = $("#slimExcerpt")[0].checked;
        extra = "slim=" + shouldSlim ? "true" : "false";
        await finish(addr, timeid, extra);
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


    const tables = await SendMsgAsync({ "action": "partdb" });
    console.log(tables);
    const tbody = document.querySelector("#maintable").querySelector("tbody");
    const rows = tables.map(tname => `<tr><td>${tname}<input type="checkbox" class="tabchooser" data-tname="${tname}" checked/></td><tr>`)
        .join("");
    tbody.innerHTML = rows;


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
            delete report.rectime;
            quickfix(report.questions);
            quickfix(report.answers);
            quickfix(report.articles);
            quickfix(report.users);
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
}()
