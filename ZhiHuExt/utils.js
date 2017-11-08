"use strict"

Array.prototype.addall = function (other)
{
    if ($.isArray(other))
        other.forEach(x => this.push(v));
    else
        console.warn("cannot add non-array to array", other);
}
Array.prototype.flatArray = function ()
{
    return Array.fromArrays(...this);
}
Array.prototype.findInArray = function(array)
{
    if (!(array instanceof Array))
    {
        console.warn("argument is not array", array);
        return;
    }
    const ret = [];
    for (let idx = 0; idx < this.length; ++idx)
    {
        let obj = this[idx];
        if (array.includes(obj))
            ret.push(obj);
    }
    return ret;
}
/**
 * @param {string} keyName
 */
Array.prototype.mapToProp = function (keyName)
{
    const ret = [];
    for (let idx = 0; idx < this.length; ++idx)
    {
        ret.push((this[idx])[keyName]);
    }
    return ret;
}
Array.fromArrays = function (...array)
{
    return [].concat.apply([], array);
}
Array.fromArray = function (array)
{
    if (array instanceof Array)
        return Array.fromArrays(...array);
    else
        return [array];
}
Array.prototype.filterUnique = function ()
{
    return Array.from(new Set(this));
}

Set.prototype.toArray = function ()
{
    return Array.from(this);
}

String.prototype.removeSuffix = function (count)
{
    const del = Math.min(this.length, count);
    return this.substring(0, this.length - del);
}

Date.prototype.Format = function (fmt)
{ //author: meizz
    const o =
    {
        "M+": this.getMonth() + 1, //月份
        "d+": this.getDate(), //日
        "h+": this.getHours(), //小时
        "m+": this.getMinutes(), //分
        "s+": this.getSeconds(), //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "S": this.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (let k in o)
        if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

$.prototype.forEach = function (consumer)
{
    this.each((idx, ele) =>
    {
        try
        {
            consumer(ele);
        }
        catch (e) { console.warn(e); }
    });
}

HTMLElement.prototype.hasClass = function (className)
{
    return this.classList.contains(className);
}
HTMLDivElement.prototype.hasChild = function (selector)
{
    if (this.querySelector(selector))
        return true;
    else
        return false;
}
Node.prototype.addClass = function (className)
{
    this.classList.add(className);
}
Node.prototype.addClasses = function (...names)
{
    for (let idx = 0, len = names.length; idx < len; ++idx)
        this.classList.add(names[idx]);
}
Node.prototype.removeClass = function (className)
{
    this.classList.remove(className);
}
Node.prototype.removeClasses = function (...names)
{
    for (let idx = 0, len = names.length; idx < len; ++idx)
        this.classList.remove(names[idx]);
}


/**
 * @template T
 * @typedef {{key: T, count: number}[]} BagArray<T>
 */
/**
 * @template T
 */
class SimpleBag
{
    /**
     * @template T
     * @param {T[] | Set<T>} [arg]
     */
    constructor(arg)
    {
        /**@type {Map<T, number>}*/
        this._map = new Map();
        if (!arg)
            return;
        if (arg instanceof Array)
            this.adds(arg);
        else if (arg instanceof Set)
        {
            for (const ele of arg)
                this._map.set(ele, 1);
        }
    }
    /**
     * @template T
     * @param {T[]} elements
     */
    adds(elements)
    {
        for (let idx = 0; idx < elements.length; ++idx)
        {
            const ele = elements[idx];
            const old = this._map.get(ele) | 0;
            this._map.set(ele, old + 1);
        }
        return this;
    }
    /**
     * @template T
     * @param {...T} elements
     */
    add(...elements) { return this.adds(elements); }
    /**
     * @template T
     * @param {T} element
     * @param {number} count
     */
    addMany(element, count)
    {
        const old = this._map.get(element) | 0;
        this._map.set(element, old + count);
        return this;
    }
    /**
     * @template T
     * @param {...T} elements
     */
    remove(...elements) { return this.removes(elements); }
    /**
     * @template T
     * @param {T[]} elements
     */
    removes(elements)
    {
        for (let idx = 0; idx < elements.length; ++idx)
        {
            const ele = elements[idx];
            const old = this._map.get(ele);
            if (old)
            {
                if (old === 1)
                    this._map.delete(ele);
                else
                    this._map.set(ele, old - 1);
            }
        }
        return this;
    }
    /**
     * @template T
     * @param {T} element
     */
    count(element)
    {
        return this._map.get(element) | 0;
    }
    /**
     * @template T
     * @param {...T} elements
     */
    removeAll(...elements)
    {
        for (let idx = 0; idx < elements.length; ++idx)
        {
            const ele = elments[idx];
            this._map.delete(ele);
        }
        return this;
    }
    /**
     * @param {"desc" | "asc"} [config]
     * @returns {BagArray<T>}
     */
    toArray(config)
    {
        const array = [];
        for (const ele of this._map)
            array.push({ "key": ele[0], "count": ele[1] });
        if (config === "desc")
            return array.sort((x, y) => y.count - x.count);
        else if (config === "asc")
            return array.sort((x, y) => x.count - y.count);
        return array;
    }
    get size() { return this._map.size; }
}


/**@description parse query string to key-value object
 * @param {string} [qurl] URL's query string
 * @returns {{[x:string]: string}} key-value object
 */
function _getQueryString(qurl)
{
    if (!qurl)
    {
        const url = window.location.href;
        const idx = url.indexOf("?") + 1;
        qurl = idx > 0 ? url.substring(idx) : "";
    }
    const querys = qurl.split("&");
    var ret = {};
    for (var i = 0; i < querys.length; ++i)
    {
        var p = querys[i].split('=');
        if (p.length != 2) continue;
        ret[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
    }
    return ret;
};
/**
 * @param {number} ms
 */
function _sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * @param {any[]} array
 * @param {Set<any>} set
 */
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
        const obj = array[idx];
        if (set.has(obj))
            inside.push(obj);
        else
            outside.push(obj);
    }
    return [inside, outside];
}
/**
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 */
function formColor(red, green, blue)
{
    const sred = red.toString(16), sgreen = green.toString(16), sblue = blue.toString(16);
    if (sred.length < 2) sred = "0" + sred;
    if (sgreen.length < 2) sgreen = "0" + sgreen;
    if (sblue.length < 2) sblue = "0" + sblue;
    return "#" + sred + sgreen + sblue;
}
/**
 * @param {string[]} extraClass
 * @param {string} text
 */
function createButton(extraClass, text)
{
    const btn = document.createElement("button");
    btn.addClass("Button");
    btn.addClasses(...extraClass);
    btn.setAttribute("type", "button");
    btn.innerText = text;
    return btn;
}
/**
 * @param {number} width
 * @param {number} height
 * @param {string} viewbox
 * @param {string[]} path
 */
function createSVG(width, height, viewbox, ...path)
{
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const pathstrs = path.map(x => "<path d='" + x + "'></path>").join("");
    svg.innerHTML = pathstrs;
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", viewbox)
    return svg;
}

async function SendMsgAsync(data)
{
    const pms = $.Deferred();
    chrome.runtime.sendMessage(data, ret => pms.resolve(ret));
    return pms;
}

