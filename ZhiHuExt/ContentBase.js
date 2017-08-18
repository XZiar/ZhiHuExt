"use strict"

function _get(url, data, type)
{
    return $.ajax(url,
        {
            type: "GET",
            data: data,
            statusCode:
            {
                429: xhr => xhr.fail()
            }
        });
}
function _post(url, data)
{
    let cType;
    if (typeof data == "string")
        cType = "application/x-www-form-urlencoded";
    else
    {
        cType = "application/json";
        data = JSON.stringify(data);
    }
    return $.ajax(url,
        {
            type: "POST",
            contentType: cType,
            //dataType: "json",
            data: data
        });
}
function _report(target, data)
{
    if (!data || (data instanceof Array && data.length === 0))
        return;
    chrome.runtime.sendMessage({ action: "insert", target: target, data: data });
}
function _update(target, key, objs, updator)
{
    if (!objs || (objs instanceof Array && objs.length === 0))
        return;
    chrome.runtime.sendMessage({ action: "update", target: target, data: { key: key, obj: objs, updator: updator } });
}

let _CUR_USER;
let _CUR_ANSWER;
class ContentBase
{
    static get CUR_USER() { return _CUR_USER; }
    static set CUR_USER(user) { _CUR_USER = user; }
}