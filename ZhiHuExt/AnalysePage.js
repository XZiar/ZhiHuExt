"use strict"


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
    return await SendMsgAsync({ "action": "dbop", "method": method, "argument": args });
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
    chrome.runtime.sendMessage({ action: "openpage", target: href, isBackground: true });
});
