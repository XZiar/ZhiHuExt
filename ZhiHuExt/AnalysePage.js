"use strict"

let rdb = null;
/**
 * @param {string} method
 * @param {any[]} args
 */
async function doAnalyse(method, ...args)
{
    return await SendMsgAsync({ "action": "analyse", "method": method, "argument": args });
}
/**
 * @param {string} method
 * @param {any[]} args
 */
async function DBfunc(method, ...args)
{
    if (!rdb)
        return await SendMsgAsync({ "action": "dbop", "method": method, "argument": args });
    else
        return await RemoteDB(rdb, method, ...args);
}


let addr = "http://127.0.0.1:8913/dbfunc";
function beginRemote(dbid)
{
    const pms = $.Deferred();
    $.ajax(addr + "/begin",
        {
            type: "GET",
            headers: { "objid": dbid }
        })
        .done(x => pms.resolve())
        .fail(err => pms.reject(err));
    return pms;
}
/**
 * @param {string} dbid
 * @param {string} method
 * @param {any[]} args
 */
function RemoteDB(dbid, method, ...args)
{
    if (method == null)
        return beginRemote(dbid);
    const pms = $.Deferred();
    const data = args.map(x => typeof (x) === "string" ? x : JSON.stringify(x));

    $.ajax(`${addr}/${method}`,
        {
            type: "POST",
            contentType: "application/json",
            headers: { "objid": dbid },
            data: JSON.stringify(data)
        })
        .done(x => pms.resolve(JSON.parse(x)))
        .fail(x => { console.warn(x); pms.reject(); });
    return pms;
}

/**
 * @param {function(any, number=):string} render
 * @param {function(any, number=):any} [elser]
 */
function displayRender(render, elser)
{
    /**
     * @param {any} data
     * @param {string} type
     * @param {number} row
     */
    const func = function(data, type, row)
    {
        if (type === 'display')
            return render(data, row);
        else if (!elser)
            return data;
        else
            return elser(data, row);
    };
    return func;
}


$(document).on("click", "a.bgopen", e =>
{
    e.preventDefault();
    const href = e.target.href;
    chrome.tabs.create({ active: false, url: href });
});
