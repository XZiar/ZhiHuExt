"use strict"

function begin()
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

function RemoteDB(method, ...args)
{
    const pms = $.Deferred();
    const data = args.map(x => typeof(x) === "string" ? x : JSON.stringify(x));
    ContentBase._post(`${addr}/${method}`, data, { "objid": dbid })
        .done(x => pms.resolve(JSON.parse(x)))
        .fail(x => { console.warn(x); pms.reject(); });
    return pms;
}

let remotedb = false;
let dbid = "";
let addr = "http://127.0.0.1:8913/dbfunc";

let iter = 0;
class UserNode
{
    /**
     * @param {User} user
     */
    constructor(user)
    {
        this.id = user.id;
        //this.it = iter + "";
        this.name = user.name;
        this.val = Math.cbrt(user.follower + 1);
        this.zancnt = user.zancnt;
        if (user.status === "ban" || user.status === "sban")
            this.color = "red";
        else
            this.color = "green";
    }
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
        chrome.runtime.sendMessage({ action: "openpage", target: "https://www.zhihu.com/people/" + node.id, isBackground: true });
    }
    else if (isCtrl)
    {
        const qs = _getQueryString();
        qs.uid = node.id;
        chrome.runtime.sendMessage({ action: "openpage", target: "/Relations.html?" + _toQueryString(qs), isBackground: true });
    }
    else
    {
        chrome.runtime.sendMessage({ action: "copy", data: node.name });
    }
});


/**
 * @param {string[]} newuser
 */
async function loadNewUser(newuser)
{
    /**@type {User[]}*/
    const users = remotedb ? await RemoteDB("getAny", "users", "id", newuser) : await DBfunc("getAny", "users", "id", newuser);
    users.forEach(usr => usrMap.set(usr.id, new UserNode(usr)));
}

/**
 * @param {number} limzan
 * @param {HTMLButtonElement} btn
 */
async function fetchAuthor(limzan, btn)
{
    btn.textContent = "查询点赞";
    const votids = votWait.toArray();
    const zanpms = remotedb ? await RemoteDB("getZanLinks", votids, "to") : DBfunc("getZanLinks", votids, "to");
    for (const uid of votWait)
        votOk.add(uid);
    votWait.clear();
    /**@type {[string,string][]}*/
    const zans = await zanpms;
    console.log(`arrive: ${zans.length} zan`);
    btn.textContent = "捕捉新用户";
    const newuser = new Set(zans.mapToProp(1).filter(uid => !usrMap.has(uid))).toArray();
    await loadNewUser(newuser);
    btn.textContent = "筛选关系";
    newuser.forEach(uid =>
    {
        const node = usrMap.get(uid);
        if (node && node.zancnt >= limzan)
            nodes.push(node), athWait.add(uid), votWait.add(uid);
    });
    zans.forEach(pair =>
    {
        const dest = pair[1];
        const node = usrMap.get(dest);
        if (node && node.zancnt >= limzan)
            links.push({ source: pair[0], target: dest });
    });
}

/**
 * @param {number} limzan
 * @param {HTMLButtonElement} btn
 */
async function fetchVoter(limzan, btn)
{
    btn.textContent = "查询点赞";
    const athids = athWait.toArray();
    const zanpms = remotedb ? await RemoteDB("getZanLinks", athids, "from") : DBfunc("getZanLinks", athids, "from");
    for (const uid of athWait)
        athOk.add(uid);
    athWait.clear();
    /**@type {[string,string][]}*/
    const zans = await zanpms;
    console.log(`arrive: ${zans.length} zan`);
    btn.textContent = "捕捉新用户";
    const newuser = new Set(zans.mapToProp(0).filter(uid => !usrMap.has(uid))).toArray();
    await loadNewUser(newuser);
    btn.textContent = "筛选关系";
    newuser.forEach(uid =>
    {
        const node = usrMap.get(uid);
        if (node && node.zancnt >= limzan)
            nodes.push(node), athWait.add(uid), votWait.add(uid);
    });
    zans.forEach(pair =>
    {
        const src = pair[0];
        const node = usrMap.get(src);
        if (node && node.zancnt >= limzan)
            links.push({ source: src, target: pair[1] });
    });
}


async function addMore(flag, btn)
{
    const limzan = $("#minzan").val();
    btn.dataset.ori = btn.textContent;
    await (flag ? fetchAuthor(limzan, btn) : fetchVoter(limzan, btn));
    btn.textContent = btn.dataset.ori;
    FGraph.graphData({ links: links, nodes: nodes });
    $("#athcnt").text(athWait.size); $("#votcnt").text(votWait.size);
    $("#nodecnt").text(nodes.length); $("#linkcnt").text(links.length);
    iter += 1;
}

$(document).on("click", "#addath", e =>
{
    addMore(true, e.target);
});
$(document).on("click", "#addvot", e =>
{
    addMore(false, e.target);
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
$(document).on("click", "#export", e =>
{
    const time = new Date().Format("yyyyMMdd-hhmm");
    if (e.ctrlKey)
    {
        const n2 = nodes.map(node => ({ id: node.id, name: node.name, color: node.color, zancnt: node.zancnt, val: node.val }));
        const l2 = links.map(link => ({ source: link.source.id, target: link.target.id }));
        const data = { nodes: n2, links: l2 };
        DownloadMan.exportDownload(data, "json", `Relations-all-${time}.json`);
    }
    else
    {
        const linkhead = "\uFEFF" + "source,target\n";
        let linktxt = linkhead + links.map(link => `${link.source.id},${link.target.id}`).join("\n");
        DownloadMan.exportDownload(linktxt, "txt", `Relations-link-${time}.csv`);
        const nodehead = "\uFEFF" + "id,name,val,zan\n";
        let nodetxt = nodehead + nodes.map(node => `${node.id},${node.name},${node.val},${node.zancnt}`).join("\n");
        DownloadMan.exportDownload(nodetxt, "txt", `Relations-node-${time}.csv`);
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
        $("#addvot").remove();
        $("#addath").remove();
        $("#zanfilt").remove();
        $("#export").remove();
        const data = await (await pms).json();
        nodes = data.nodes;
        links = data.links;
        $("#nodecnt").text(nodes.length); $("#linkcnt").text(links.length);
        FGraph.graphData({ links: links, nodes: nodes });
    }
    if (qs.remotedb != null)
    {
        dbid = qs.remotedb;
        remotedb = true;
        await begin();
    }
    if (qs.uid != null)
    {
        const uids = qs.uid.split("*");
        await loadNewUser(uids);
        iter = 1;
        usrMap.forEach(node =>
        {
            node.color = "blue";
            nodes.push(node);
            athWait.add(node.id), votWait.add(node.id);
        })
        FGraph.graphData({ links: links, nodes: nodes });
    }

    $("#athcnt").text(athWait.size); $("#votcnt").text(votWait.size);

}()

