"use strict"

// for common injects

/**@type {string}*/
let CUR_VOTER_TYPE;
let CUR_VOTER_ID;
let LIM_FetchVoter = 20000;
let AUTO_SPIDE_ZAN = false, NOW_SPIDE = false;// dirty hack for auto-spide, assume single-thread-safe
/**@type {{ name: string, btn: HTMLButtonElement }}*/
let SPIDE_LIST = [];


function setLimVoter(count)
{
    console.log(`set Voter Fetch Limit from ${LIM_FetchVoter} to ${count}`);
    LIM_FetchVoter = count;
}

async function autoReportAll(ev)
{
    ev.preventDefault();
    const thisbtn = ev.target;
    /**@type {string}*/
    const txt = ev.dataTransfer.getData("text");
    let report;
    let type;
    if (txt.includes("http"))
    {
        const mth1 = txt.match(/zhihu.com\/question\/\d*\/answer\/(\d*)/i);
        const mth2 = txt.match(/zhuanlan.zhihu.com\/p\/(\d*)/i);
        const mth3 = txt.match(/www.zhihu.com\/people\/([^\/]*)/i);
        if (mth1)
        {
            report = { id: Number(mth1[1]), type: "badans" }; type = "answer";
        }
        else if (mth2)
        {
            report = { id: Number(mth2[1]), type: "badart" }; type = "article";
        }
        else if (mth3)
        {
            ContentBase.reportSpam(mth3[1], "member");
        }
    }
    else if (txt.startsWith("{"))
    {
        const dat = JSON.parse(txt);
        report = { id: Number(dat.id), type: dat.type === "answer" ? "badans" : "badart" };
        type = dat.type;
    }
    if (!report)
        return;
    ContentBase._report("spams", report);
    const result = await ContentBase.checkSpam(type, report.id);
    const uids = result.normal.filter(u => u != "");
    thisbtn.textContent = `${uids.length}/${result.total}`;
    let cnt = 0;
    let alldone = true;
    for (let i = 0; i < uids.length; ++i)
    {
        const uid = uids[i];
        const user = await ContentBase.checkUserState(uid, undefined, [1]);
        if (!user)
            continue;
        thisbtn.textContent = uid;
        if (user.status === "ban" || user.status === "sban")
        {
            PageBase.setChkStatusColor(thisbtn, "ban");
            const acts = (await ContentBase.fetchUserActs(uid, 236)).acts;
            ContentBase._report("batch", acts);
        }
        else
        {
            try
            {
                PageBase.setChkStatusColor(thisbtn, "succ");
                await ContentBase.reportSpam(uid, "member");
                cnt++;
            }
            catch (e)
            {
                alldone = false;
                break;
            }
        }
    }
    PageBase.setChkStatusColor(thisbtn, alldone ? "succ" : "fail");
    thisbtn.textContent = cnt + "个";
}

/**
 * @param {HTMLElement} element
 */
function setDraggable(element)
{
    element.draggable = true;
    element.ondragstart = (ev) =>
    {
        ev.dataTransfer.setData("text", JSON.stringify(ev.target.dataset));
    }
    if (element.classList.contains("Btn-ReportSpam"))
    {
        element.ondragover = ev => ev.preventDefault();
        element.ondrop = autoReportAll;
    }
}


async function addSpamVoterBtns(voterNodes)
{
    const users = [];
    const btnMap = new Map();
    for (let idx = 0; idx < voterNodes.length; ++idx)
    {
        const node = voterNodes[idx];
        const nameLink = $(".UserItem-name .UserLink-link", node).get(0);
        if (!nameLink)
            continue;
        const uid = nameLink.getAttribute("href").split("/").pop();
        users.push(uid);
        const moduleNode = node.children[0];
        const dset = JSON.parse(moduleNode.dataset.zaModuleInfo || moduleNode.dataset.zaExtraModule);
        const hashid = dset.card.content.member_hash_id;
        if (hashid[0] === "#" && hashid != "#-1")
        {
            const votedate = Number(hashid.substr(1));
            const [, , , hour, minu, ,] = new Date(votedate * 1000).getDetailCHN();
            $(".ContentItem-status", node).append(makeElement("span", "ContentItem-statusItem", null, `${hour}:${minu}`));
        }

        const btn = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
        btn.dataset.id = uid;
        btn.dataset.type = "member";
        $(".ContentItem-extra", node).prepend(btn);
        btnMap.set(uid, btn);

        const btn2 = createButton(["Btn-CheckStatus", "Button--primary"], "检测");
        btn2.dataset.id = uid;
        setDraggable(btn2);
        $(".ContentItem-extra", node).prepend(btn2);
    }
    const result = await ContentBase.checkSpam("users", users);
    PageBase.setUserStatusColor(result, btnMap);
    const normalList = [];
    btnMap.forEach((btn, uid) =>
    {
        if (!result.banned.has(uid) && !result.spamed.has(uid) && btn.parentNode)
            normalList.push({ name: uid, btn: btn.parentNode.children[0] });
    });
    if (AUTO_SPIDE_ZAN)
    {
        if (NOW_SPIDE)
            SPIDE_LIST.push(...normalList)
        else
            $(".Btn-CheckAllStatus").click();// assume we can find this button
    }
};
const voterObserver = new MutationObserver(records =>
{
    const voterNodes = Array.fromArray(
        records.filter(record => (record.type == "childList" && record.target.nodeName == "DIV"))
            .map(record => $.makeArray(record.addedNodes)))
        .filter(node => node.hasClass("List-item") && !node.hasChild(".Btn-ReportSpam"));
    addSpamVoterBtns(voterNodes);
});
function monitorVoter(voterPopup)
{
    voterObserver.disconnect();
    console.log("detected voter-popup", voterPopup);
    const curVoters = $(voterPopup).find(".List-item").toArray()
        .filter(node => !node.hasChild(".Btn-ReportSpam"));
    console.log("current " + curVoters.length + " voters", curVoters);
    addSpamVoterBtns(curVoters);
    voterObserver.observe($(voterPopup)[0], { "childList": true });
    const title = $(voterPopup).siblings(".Topbar").find(".Topbar-title")[0];
    if (title)
    {
        const btn1 = createButton(["Btn-CheckAllStatus", "Button--primary"], "检测全部");
        btn1.ondragover = ev => ev.preventDefault();
        btn1.ondrop = ev =>
        {
            ev.preventDefault();
            const thisbtn = ev.target;
            /**@type {{uid:string}}*/
            const ds = JSON.parse(ev.dataTransfer.getData("text"));
            const btns = $(".Btn-CheckStatus", voterPopup).toArray();
            for (let i = 0; i < btns.length; ++i)
            {
                if (btns[i].dataset.id == ds.id)
                    break;
                if (btns[i].style.backgroundColor == "")
                    PageBase.setChkStatusColor(btns[i], "succ");
            }
        }
        const btn2 = createButton(["Btn-AssocAns", "Button--primary"], "启发");
        const btn3 = createButton(["Btn-Similarity", "Button--primary"], "相似性");
        const btn4 = createButton(["Btn-ShowTime", "Button--primary"], "时间图");
        const btn5 = createButton(["Btn-AutoSpide", "Button--primary"], "自动");
        btn5.onclick = function (ev)
        {
            if (!AUTO_SPIDE_ZAN)
            {
                AUTO_SPIDE_ZAN = true;
                PageBase.setChkStatusColor(btn5, "succ");
                btn1.click();
            }
            else
            {
                AUTO_SPIDE_ZAN = false;
                PageBase.setChkStatusColor(btn5, "clear");
            }
        }; 

        btn2.dataset.id = CUR_VOTER_ID, btn4.dataset.id = CUR_VOTER_ID;
        switch (CUR_VOTER_TYPE)
        {
        case "answer":
            btn2.dataset.qname = "ansid", btn4.dataset.qname = "ansid";
            break;
        case "article":
            btn2.dataset.qname = "artid", btn4.dataset.qname = "artid";
            break;
        case "question":
            btn2.dataset.qname = "qfid", btn4.dataset.qname = "qfid";
            break;
        }

        title.appendChild(btn1);
        title.appendChild(btn2);
        title.appendChild(btn3);
        title.appendChild(btn4);
        title.appendChild(btn5);
    }
}

/**
 * @param {HTMLDivElement} node
 * @return {{type: string, token: string, upvote_num: number, comment_num: number, parent_token: string, author_member_hash_id: string}}
 */
function getAAInfo(node)
{
    try
    {
        const oldInfo = node.dataset.zaModuleInfo || node.dataset.zaExtraModule;
        if (oldInfo)
            return JSON.parse(oldInfo).card.content;
        const info = node.dataset.zop;
        if (info)
            return JSON.parse(info);
        if (Object.keys(node.dataset).length !== 0)
            throw node.dataset;
        return null;
    }
    catch (e)
    {
        console.warn("in paring for AASpamBtn, Zhihu may have update API", node.dataset);
        return null;
    }
}

/**
 * Add "Analyse" and "ReportSpam" buttons for each ".List-item"
 * @param {HTMLDivElement[]} answerNodes
 */
async function addAASpamBtns(answerNodes)
{
    /**@type {Map<string, HTMLDivElement>}*/
    const athMap = new Map();
    answerNodes.filter(node => !node.hasChild(".Btn-ReportSpam"))
        .forEach(node =>
        {
            if (!node) return;
            const ansInfo = getAAInfo(node);
            if (!ansInfo) return;
            let atype;
            if (ansInfo.type === "Answer" || ansInfo.type === "answer")
                atype = "answer";
            else if (ansInfo.type === "Post" || ansInfo.type === "article")
                atype = "article";
            else
                return;

            const aid = ansInfo.token || ansInfo.itemId;
            const aArea = node.querySelector(".AuthorInfo");
            if (!aArea)
                return;
            {
                const btn = createButton(["Btn-CheckSpam", "Button--primary"], "分析");
                btn.dataset.id = aid;
                btn.dataset.type = atype;
                setDraggable(btn);
                aArea.appendChild(btn);
            }
            {
                const btn = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
                btn.dataset.id = aid;
                btn.dataset.type = atype;
                setDraggable(btn);
                aArea.appendChild(btn);
            }
            const urlMeta = aArea.querySelector("meta[itemprop=url]").content || "";
            const athMth = urlMeta.match(/www.zhihu.com\/people\/([^\/]*)/i);
            if (athMth && athMth[1])
                athMap.set(athMth[1], aArea.querySelector("div.AuthorInfo-head"));
        });
    const result = await ContentBase.checkSpam("users", Array.from(athMap.keys()));
    PageBase.setUserStatusColor(result, athMap);
}

function addQuickCheckBtns(feedbackNodes)
{
    feedbackNodes.filter(node => !node.hasChild(".Btn-QCheckStatus"))
        .forEach(node =>
        {
            const hrefNode = Array.from(node.children[1].querySelectorAll("a"))
                .filter(aNode => aNode.href.includes("/people/"))[0];
            if (!hrefNode)
                return;
            let uid = hrefNode.href.split("/").pop();
            const btnNode = node.children[2];
            const btn = createButton(["Btn-QCheckStatus"], "检测");
            btn.dataset.id = uid;
            btnNode.insertBefore(btn, btnNode.children[1]);
        });
}

function onCloseVoterPopup()
{
    if (ContentBase.CUR_HOOKER)
    {
        ContentBase.CUR_HOOKER.dataset.blockingVoters = false;
    }
    // if (document.body.querySelector("#ZHE_BLOCKING_VOTER"))
    //     document.body.removeChild(BLOCKING_FLAG);
    CUR_VOTER_ID = null;
    CUR_VOTER_TYPE = null;
    AUTO_SPIDE_ZAN = false;
    SPIDE_LIST = [];
}

const bodyObserver = new MutationObserver(records =>
{
    //console.log("detect add body comp", records);
    const addNodes = Array.fromArray(records
        .map(record => $.makeArray(record.addedNodes)
            .filter(node => node instanceof HTMLDivElement)
        ));
    const delNodes = Array.fromArray(records
        .map(record => $.makeArray(record.removedNodes)
            .filter(node => node instanceof HTMLDivElement)
        ));
    {//check voter-popup
        const voterPopup = $(addNodes).find(".VoterList-content").toArray();
        if (voterPopup.length > 0)
            monitorVoter(voterPopup);
        if ($(delNodes).find(".VoterList-content").length > 0)
        {
            console.log("here removed", delNodes);
            onCloseVoterPopup();
        }
    }
    {
        const ansartNodes = $(addNodes).find(".AnswerItem, .ArticleItem").toArray();
        if (ansartNodes.length > 0)
            addAASpamBtns(ansartNodes);
    }
    {
        $(addNodes).find(".HitQrcode").remove();//remove download-app banner
    }
});
    

$("body").on("click", "button.Btn-ReportSpam", function ()
{
    const btn = $(this)[0];
    ContentBase.reportSpam(btn.dataset.id, btn.dataset.type)
        .done(() => PageBase.setChkStatusColor(btn, "succ"))
        .fail((e) =>
        {
            console.warn("report fail:" + e.code, e.error);
            if (e.code === 103001)//repeat
                PageBase.setChkStatusColor(btn, "repeat");
            else if (e.code === 4039)//need verify
                PageBase.setChkStatusColor(btn, "verify");
            else
                PageBase.setChkStatusColor(btn, "fail");
        });
});
$("body").on("click", "button.Btn-CheckSpam", async function (e)
{
    /**@type {HTMLButtonElement}*/
    const btn = e.target;
    const id = btn.dataset.id;
    const type = btn.dataset.type;
    let total, result;
    if (e.shiftKey)
    {
        if (e.ctrlKey)
        {
            if (ContentBase.CUR_HOOKER)
            {
                ContentBase.CUR_HOOKER.dataset.blockingVoters = true;
            }
            //document.body.appendChild(BLOCKING_FLAG);
            const showbtn = btn.parentNode.parentNode.querySelector(".Voters").querySelector("button");
            showbtn.click();
            return;
        }
        result = await ContentBase.checkSpam(type, Number(id));
        total = result.total;
    }
    else
    {
        const voters = await ContentBase.fetchTheVoters(type, id, LIM_FetchVoter, e.ctrlKey ? "old" : "new",
            (cur, all) => btn.innerText = "=>" + cur + "/" + all);
        {
            const rep = { users: voters };
            if (type === "answer")
                rep.zans = voters.map(user => new Zan(user, id));
            else if (type === "article")
                rep.zanarts = voters.map(user => new Zan(user, id));
            ContentBase._report("batch", rep);
        }
        btn.addClass("Button--blue");

        result = await ContentBase.checkSpam("users", voters.mapToProp("id"));
        total = voters.length;
    }
    const ban = result.banned.size, spm = result.spamed.size;
    btn.innerText = "(" + ban + "+" + spm + ")/" + total;
    btn.style.fontSize = "smaller";
    btn.style.fontWeight = "bold";

    if (total === 0)
        return;

    const ratio = (2 * (ban + spm) / total) - 1;
    const blue = 64 - Math.ceil(Math.abs(ratio) * 32);
    const red = ratio > 0 ? 224 : Math.ceil((ratio + 1) * 192) + 32;
    const green = ratio < 0 ? 224 : 224 - Math.ceil(ratio * 192);
    btn.style.backgroundColor = "rgb(" + red + "," + green + "," + blue + ")";
});

async function onChkStatus(e)
{
    const btn = e.target;
    const uid = btn.dataset.id;
    if (e.ctrlKey)
    {
        chrome.runtime.sendMessage({ action: "openpage", target: "https://www.zhihu.com/people/" + uid + "/activities", isBackground: true });
        return;
    }
    const user = await ContentBase.checkUserState(uid, undefined, [1]);
    if (!user)
        return;
    const repBtn = $(btn).siblings(".Btn-ReportSpam")[0];
    if (user.status === "ban" || user.status === "sban")
    {
        PageBase.setChkStatusColor(btn, "ban");
        PageBase.setChkStatusColor(repBtn, "ban");
        const acts = (await ContentBase.fetchUserActs(uid, 236)).acts;
        ContentBase._report("batch", acts);
    }
    else
    {
        PageBase.setChkStatusColor(btn, "succ");
        PageBase.setChkStatusColor(repBtn, "clear");
    }
}

$("body").on("click", "button.Btn-CheckStatus", onChkStatus);
$("body").on("click", "button.Btn-CheckAllStatus", async function (e)
{
    if (NOW_SPIDE)
    {
        NOW_SPIDE = false;
        return;
    }
    const btn = $(this)[0];
    const isCtrl = e.ctrlKey, isShift = e.shiftKey;
    const voterList = btn.parentNode.parentNode.parentNode;
    SPIDE_LIST = [];
    $(voterList).find(".ContentItem-extra").each((idx, extraArea) =>
    {
        const btnChk = extraArea.children[0], btnSpam = extraArea.children[1];
        if (btnChk.style.backgroundColor != "")//has result
            return;
        if (!isShift && btnSpam.style.backgroundColor == "black")
            return;
        if (!isCtrl && btnSpam.style.backgroundColor != "")
            return;
        SPIDE_LIST.push({ name: btnChk.dataset.id, btn: btnChk });
    });
    console.log("detect " + SPIDE_LIST.length + " user");
    try
    {
        NOW_SPIDE = true;
        for (let idx = 0; idx < SPIDE_LIST.length && NOW_SPIDE; ++idx)
        {
            btn.textContent = SPIDE_LIST[idx].name;
            const event = { target: SPIDE_LIST[idx].btn, ctrlKey: false };
            await Promise.all([onChkStatus(event), _sleep(1000 + idx * 9)]);
        }
    }
    finally
    {
        NOW_SPIDE = false;
    } 
    btn.textContent = "检测全部";
});
$("body").on("click", "span.Voters", function ()
{
    const span = $(this)[0];
    const itemNode = $(span).parents("div.AnswerItem")[0] || $(span).parents("div.ArticleItem")[0];
    if (!itemNode)
        return;
    const aaInfo = getAAInfo(itemNode);
    if (!aaInfo) return;
    if (aaInfo.type === "Answer" || aaInfo.type === "answer")
        CUR_VOTER_TYPE = "answer", CUR_VOTER_ID = aaInfo.token || aaInfo.itemId;
    else if (aaInfo.type === "Post" || aaInfo.type === "article")
        CUR_VOTER_TYPE = "article", CUR_VOTER_ID = aaInfo.token || aaInfo.itemId;
    else
        return;
});
$("body").on("click", "button.NumberBoard-item", e =>
{
    const btn = e.target;
    const headerNode = $(btn).parents("div.QuestionHeader")[0];
    const itemName = $(btn).parents("button.NumberBoard-item").find("div.NumberBoard-itemName").text();
    if (headerNode && itemName === "关注者")
    {
        const headerContent = JSON.parse(headerNode.dataset.zaModuleInfo || headerNode.dataset.zaExtraModule).card.content;
        CUR_VOTER_TYPE = "question", CUR_VOTER_ID = headerContent.token;
    }
});
$("body").on("mousedown", "button.NumberBoard-item", e =>
{
    const btn = e.target;
    if (e.shiftKey && e.ctrlKey)
    {
        if (ContentBase.CUR_HOOKER)
        {
            ContentBase.CUR_HOOKER.dataset.blockingVoters = true;
        }
        //document.body.appendChild(BLOCKING_FLAG);
    }
    //e.preventDefault();
});
$("body").on("click", "button.Btn-AssocAns", e =>
{
    const btn = e.target;
    let query = `${btn.dataset.qname}=${btn.dataset.id}`;
    if (!btn.dataset.qname)
        query = `vid=` + $(".Btn-CheckStatus").toArray().map(x => x.dataset.id).join("*");
    const target = e.ctrlKey ? "StatVoter.html?" : "AssocAns.html?";
    chrome.runtime.sendMessage({ action: "openpage", isBackground: false, target: target + query });
});
$("body").on("click", "button.Btn-StatVoter", e =>
{
    const btn = e.target;
    const query = `${btn.dataset.qname}=${btn.dataset.id}`;
    chrome.runtime.sendMessage({ action: "openpage", isBackground: false, target: "StatVoter.html?" + query });
});
$("body").on("click", "button.Btn-ShowTime", e =>
{
    const btn = e.target;
    const query = e.ctrlKey && btn.dataset.qname === "uid" ? `athid=${btn.dataset.id}` : `${btn.dataset.qname}=${btn.dataset.id}`;
    chrome.runtime.sendMessage({ action: "openpage", isBackground: false, target: "Timeline.html?" + query });
});
$("body").on("click", "button.Btn-Similarity", e =>
{
    const thisbtn = e.target;
    const msg = { action: "chksim", target: "", data: null };
    msg.target = CUR_VOTER_TYPE, msg.data = CUR_VOTER_ID;
    const voterList = thisbtn.parentNode.parentNode.parentNode;
    /**@type {HTMLButtonElement[]}*/
    const btns = [];
    $(voterList).find(".ContentItem").each((idx, item) =>
    {
        const extraArea = item.querySelector(".ContentItem-extra");
        if (!extraArea)
            return;
        btns.push(extraArea.children[1]);
    });
    console.log("detect " + btns.length + " user");
    chrome.runtime.sendMessage(msg, /**@param {[string, [number, number, number]][]} result*/(result) =>
    {
        console.log(result);
        const simmap = new Map(result.data);
        let maxcnt = 0;
        btns.forEach(btn =>
        {
            const counts = simmap.get(btn.dataset.id);
            btn.textContent = `${counts[0]}(${counts[1]})/${counts[2]}`;
            btn.style.fontSize = "smaller";
            btn.style.fontWeight = "bold";
            maxcnt = Math.max(maxcnt, counts[0]);
        });
        thisbtn.textContent = `${maxcnt}(${result.limit})`;
        thisbtn.style.fontSize = "smaller";
        thisbtn.style.fontWeight = "bold";
    });
});
$("body").on("click", "button.Modal-closeButton", onCloseVoterPopup);
$("body").on("dragover", ".RichContent-inner", ev =>
{
    const wrapper = ev.currentTarget.parentElement.parentElement;
    if (wrapper.className.includes("AnswerItem") || wrapper.className.includes("ArticleItem"))
        ev.preventDefault();
});
$("body").on("drop", ".RichContent-inner", ev =>
{
    ev.preventDefault();
    /**@type {string}*/
    const txt = ev.originalEvent.dataTransfer.getData("text");
    if (txt != "MarkBtn") return;
    const wrapper = ev.currentTarget.parentElement.parentElement;
    let target;
    if (wrapper.className.includes("AnswerItem"))
        target = "answer";
    else if (wrapper.className.includes("ArticleItem"))
        target = "article";
    else
        return;

    const ansInfo = getAAInfo(wrapper);
    const aid = ansInfo.token || ansInfo.itemId;
    saveADetail(target, aid);
});


{
    $(".Btn-ReportSpam").toArray().forEach(setDraggable);
    const curAnsArts = $(".AnswerItem, .ArticleItem").toArray();
    console.log("init " + curAnsArts.length + " answer/article");
    addAASpamBtns(curAnsArts);
}

async function ZhiBtnDropper(ev)
{
    ev.preventDefault();
    /**@type {string}*/
    const txt = ev.dataTransfer.getData("text");
    if (!txt.startsWith("{") || !txt.endsWith("}"))
        return;
    const dat = JSON.parse(txt);
    if (dat.type !== "answer" && dat.type !== "article")
        return;
    let args = []
    if (dat.type == "answer")
        args = [Number(dat.id), []];
    else
        args = [[], Number(dat.id)];
    await SendMsgAsync({ action: "analyse", method: "filterUntimedVotersById", argument: args });
}

async function TrashDropper(ev)
{
    const mapper = { answer: "badans", article: "badart", member: "badusr" };
    ev.preventDefault();
    /**@type {string}*/
    const txt = ev.dataTransfer.getData("text");
    let report;
    if (txt.includes("http"))
    {
        const mth1 = txt.match(/zhihu.com\/question\/\d*\/answer\/(\d*)/i);
        const mth2 = txt.match(/zhuanlan.zhihu.com\/p\/(\d*)/i);
        const mth3 = txt.match(/www.zhihu.com\/people\/([^\/]+)/i);
        if (mth1)
            report = { id: Number(mth1[1]), type: "badans" };
        else if (mth2)
            report = { id: Number(mth2[1]), type: "badart" };
        else if (mth3)
            report = { id: mth3[1], type: "badusr" };
    }
    else if (txt.startsWith("{") && txt.endsWith("}"))
    {
        const dat = JSON.parse(txt);
        report = { id: Number(dat.id), type: mapper[dat.type] };
    }
    else if (txt.startsWith("#comment"))
    {
        const aid = Number(txt.substr(8));
        const cms = await ContentBase.fetchComments(aid, 1000);
        const users = cms.map(cm => User.fromRawJson(cm.author.member));
        console.log(users);
        ContentBase._report("users", users);
        report = users.map(usr => ({ id: usr.id, type: "badusr" })).filter(x => x.id);
    }
    if (report)
    {
        if (!ev.ctrlKey)
        {
            ContentBase._report("spams", report);
            return;
        }
    }
}
{
    const svgZH = createSVG(24, 24, "0 0 100 91",
        "M53.29 80.035l7.32.002 2.41 8.24 13.128-8.24h15.477v-67.98H53.29v67.978zm7.79-60.598h22.756v53.22h-8.73l-8.718 5.473-1.587-5.46-3.72-.012v-53.22zM46.818 43.162h-16.35c.545-8.467.687-16.12.687-22.955h15.987s.615-7.05-2.68-6.97H16.807c1.09-4.1 2.46-8.332 4.1-12.708 0 0-7.523 0-10.085 6.74-1.06 2.78-4.128 13.48-9.592 24.41 1.84-.2 7.927-.37 11.512-6.94.66-1.84.785-2.08 1.605-4.54h9.02c0 3.28-.374 20.9-.526 22.95H6.51c-3.67 0-4.863 7.38-4.863 7.38H22.14C20.765 66.11 13.385 79.24 0 89.62c6.403 1.828 12.784-.29 15.937-3.094 0 0 7.182-6.53 11.12-21.64L43.92 85.18s2.473-8.402-.388-12.496c-2.37-2.788-8.768-10.33-11.496-13.064l-4.57 3.627c1.363-4.368 2.183-8.61 2.46-12.71H49.19s-.027-7.38-2.372-7.38",
        { fill: "#ff7000" });
    const btn1 = createButton(["CornerButton", "Button--plain"]);
    btn1.dataset.tooltip = "知乎疯牛病";
    btn1.dataset.tooltipPosition = "left";
    btn1.appendChild(svgZH);
    
    const btndiv1 = makeElement("div", "CornerAnimayedFlex", { id: "MarkBtn" }, btn1);
    btndiv1.draggable = true;
    btndiv1.ondragstart = (ev) =>
    {
        ev.dataTransfer.setData("text", "MarkBtn");
    }
    btndiv1.ondragover = ev => ev.preventDefault();
    btndiv1.ondrop = ZhiBtnDropper;

    const svgTrash = createSVG(28, 28, "0 0 512 512",
        "M341,128V99c0-19.1-14.5-35-34.5-35H205.4C185.5,64,171,79.9,171,99v29H80v32h9.2c0,0,5.4,0.6,8.2,3.4c2.8,2.8,3.9,9,3.9,9  l19,241.7c1.5,29.4,1.5,33.9,36,33.9h199.4c34.5,0,34.5-4.4,36-33.8l19-241.6c0,0,1.1-6.3,3.9-9.1c2.8-2.8,8.2-3.4,8.2-3.4h9.2v-32  h-91V128z M192,99c0-9.6,7.8-15,17.7-15h91.7c9.9,0,18.6,5.5,18.6,15v29H192V99z M183.5,384l-10.3-192h20.3L204,384H183.5z   M267.1,384h-22V192h22V384z M328.7,384h-20.4l10.5-192h20.3L328.7,384z",
        { fill: "#000" });
    const btn2 = createButton(["CornerButton", "Button--plain"]);
    btn2.dataset.tooltip = "记录广告";
    btn2.dataset.tooltipPosition = "left";
    btn2.appendChild(svgTrash);
    const btndiv2 = makeElement("div", "CornerAnimayedFlex", { id: "TrashBtn" }, btn2);
    btndiv2.ondragover = ev => ev.preventDefault();
    btndiv2.ondrop = TrashDropper;

    const fbtns = document.body.querySelector(".CornerButtons");
    if (fbtns)
    {
        fbtns.prepend(btndiv1);
        fbtns.prepend(btndiv2);
    }
}

bodyObserver.observe(document.body, { "childList": true, "subtree": true });
