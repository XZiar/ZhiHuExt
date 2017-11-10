"use strict"

!async function ()
{
    const auth = "fwAAASLR" + "171109a";
    /**
     * @param {string} table
     * @param {number} offset
     * @param {number} count
     * @returns {Promise<string>}
     */
    async function fetchdb(table, offset, count)
    {
        return await SendMsgAsync({ action: "partdb", target: table, from: offset, count: count });
    }
    /**
     * @param {string} table
     * @param {string} data
     * @param {string} addr
     * @param {string} id
     */
    async function sendpart(table, data, addr, id)
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

    function finish(addr, id)
    {
        const pms = $.Deferred();
        $.ajax(addr + "/finish",
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
            while (true)
            {
                const part = await fetchdb(tables[i], offset, partlen);
                if (part === "[]")
                    break;
                const pms = sendpart(tables[i], part, addr, timeid);
                if (onProgress)
                    onProgress(tables[i], offset);
                offset += partlen;
                await pms;
            }
        }
        await finish(addr, timeid);
    }

    /**
     * @param {number | number[]} ids
     * @param {"Answer" | "Article"} target
     * @returns {BagArray}
     */
    async function getVoters(ids, target)
    {
        const method = target === "Answer" ? "getAnsVoters" : "getArtVoters";
        const voters = await SendMsgAsync(payload(method, ids));
        console.log("voters", voters);
        return voters;
    }


    const tables = await SendMsgAsync({ "action": "partdb" });
    console.log(tables);
    const tbody = document.querySelector("#maintable").querySelector("tbody");
    const rows = tables.map(tname => `<tr><td>${tname}</td><td><input type="checkbox" class="tabchooser" data-tname="${tname}" checked/></td><tr>`)
        .join("");
    tbody.innerHTML = rows;

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
            thisbtn.textContent = "¿ªÊ¼·¢ËÍ";
            thisbtn.style.backgroundColor = "rgb(0,224,32)";
        }
        catch (e)
        {
            console.warn(e);
            thisbtn.style.backgroundColor = "rgb(224,0,32)";
        }
    })
}()
