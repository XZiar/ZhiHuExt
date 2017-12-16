"use strict"

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
function _toQueryString(obj)
{
    const query = Object.entries(obj).map(x => `${x[0]}=${x[1]}`).join("&");
    return query;
}

/**@type {Set<string>}*/
const athOk = new Set(), votOk = new Set(), athWait = new Set(), votWait = new Set();
/**@type {Map<string, UserNode>}*/
const usrMap = new Map();
/**@type {UserNode[]}*/
let nodes = [];
/**@type {{source:string, target:string}[]}*/
let links = [];

let isCtrl = false, isShift = false;
document.addEventListener("keydown", ev => { isCtrl = ev.ctrlKey; isShift = ev.shiftKey; });
document.addEventListener("keyup", ev => { isCtrl = ev.ctrlKey; isShift = ev.shiftKey; });

const FGraph = ForceGraph3D()(document.getElementById("graph"));
FGraph.numDimensions(3);
//FGraph.forceEngine('ngraph');
FGraph.cooldownTime(40000);
//FGraph.autoColorBy("it");
FGraph.lineOpacity(0.05);
FGraph.nodeRelSize(1);
FGraph.nodeResolution(4);
FGraph.onNodeClick(/**@param {UserNode} node*/ (node) =>
{
    if (isShift)
    {
        window.open("https://www.zhihu.com/people/" + node.id);
    }
});


$(document).on("click", "#chgdim", e =>
{
    if (e.ctrlKey)
    {
        FGraph.numDimensions(FGraph.numDimensions() == 2 ? 3 : 2);
        links = links.map(link => ({ source: link.source.id, target: link.target.id }));
        FGraph.graphData({ links: links, nodes: nodes });
    }
    else
    {
        const qs = _getQueryString();
        qs.dim = (qs.dim === "2d" ? "3d" : "2d");
        window.location.search = "?" + _toQueryString(qs);
    }
});

!async function()
{
    const qs = _getQueryString();
    if (qs.dim === "2d")
    {
        FGraph.numDimensions(2);
    }
    if (qs.src != null)
    {
        const pms = fetch(qs.src + ".json");
        const data = await (await pms).json();
        nodes = data.nodes;
        links = data.links;
        $("#nodecnt").text(nodes.length); $("#linkcnt").text(links.length);
        FGraph.graphData({ links: links, nodes: nodes });
    }

}()

