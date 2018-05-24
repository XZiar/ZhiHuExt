"use strict"

//enhances on each type of ZhiHu pages


/**@type {QuestType | string}*/
let pageData;
let pageType;

function rootFinder(records)
{
    for (let i = 0; i < records.length; ++i)
    {
        const record = records[i];
        if (record.type != "childList")
            continue;
        const nodes = record.addedNodes;
        for (let j = 0; j < nodes.length; ++j)
        {
            const node = nodes[j];
            if (!(node instanceof Element))
                continue;
            if (node.id === "data")
                return node;
            const obj = node.querySelector("#data");
            if (obj)
                return obj;
        }
    }
    return null;
}

function onObjFound(obj)
{
    const state = JSON.parse(obj.dataset.state);
    console.log(state);
    const entities = APIParser.parseEntities(state.entities);
    ContentBase._report("batch", entities);
    if (state.token)
        ContentBase.CUR_TOKEN = new UserToken(state.token);
    console.log(entities);
    if (pageType === "people")
    {
        //process user
        ContentBase.CUR_USER = entities.users.filter(u => u.id === pageData)[0];
        console.log("the user", ContentBase.CUR_USER);
        setTimeout(peopleEnhance, 800);//later refesh may erase added buttons(sometimes won't), so delay it.
    }
    else if (pageType === "question")
    {
        pageData = Object.values(state.entities.questions)[0];
        setTimeout(qstEnhance, 800);//later refesh may erase added buttons, so delay it.
    }
}

function processArticleOld(obj)
{
    let txt = obj.innerText;
    {
        const part = txt.split("new Date(");
        txt = part[0] + part[1].replace(")", "");
    }
    const artdata = JSON.parse(txt);
    console.log(artdata);

    const artdb = artdata.database;
    const output = new StandardDB();
    {
        //process user
        const selfUser = artdata.me.slug;
        const usersEntry = Object.entries(artdb.User);
        for (let i = 0; i < usersEntry.length; ++i)
        {
            const [name, theuser] = usersEntry[i];
            if (name === selfUser)
                continue;
            const user = User.fromRawJson(theuser);
            output.users.push(user);
        }

        /**@type {ArtType}*/
        const post = Object.values(artdb.Post)[0];
        output.topics.push(...post.topics.map(t => new Topic(t.id, t.name)));
        const article = new Article(post.slug, post.title, post.author, post.likesCount, post.summary.replace(/<[^>]+>/g, ""),
            Date.parse(post.publishedTime) / 1000, Date.parse(post.updated) / 1000);
        if (post.content)
        {
            const dt = new ADetail(article.id, post.content);
            output.details.push(dt);
        }
        output.articles.push(article);
        post.lastestLikers.forEach(theuser =>
        {
            const user = User.fromRawJson(theuser);
            output.users.push(user);
            output.zanarts.push(new Zan(user, article));
        });

        [post.meta.previous, post.meta.next].filter(p => p != null).forEach(p =>
        {
            const ath = User.fromRawJson(p.author);
            output.users.push(ath);
            output.topics.push(...p.topics.map(t => new Topic(t.id, t.name)));
            const subart = new Article(p.slug, p.title, ath.id, p.likesCount, p.summary.replace(/<[^>]+>/g, ""),
                Date.parse(p.publishedTime) / 1000);//no updated time
            if (p.content)
            {
                const dt = new ADetail(article.id, p.content);
                output.details.push(dt);
            }
            output.articles.push(subart);
        });
    }

    console.log("artpage-report", output);
    ContentBase._report("batch", output);
}

async function peopleEnhance()
{
    $("body").on("click", ".Btn-AutoActSpider", async e =>
    {
        const thisbtn = e.target;
        const theuid = thisbtn.dataset.id;
        const lcount = e.shiftKey ? 270 : (e.ctrlKey ? 70 : 5);
        const ret = await ContentBase.fetchUserActs(theuid, lcount, undefined, undefined,
            (cur, time) => thisbtn.innerText = cur + "/" + Date.fromUTCSeconds(time).Format("MMdd"));
        const acts = ret.acts.selfMerge();
        thisbtn.innerText = (acts.zans.length + acts.zanarts.length) + "赞";
        ContentBase._report("batch", acts);
        console.log(acts);
    });

    const header = $("#ProfileHeader")[0];
    if (!header)
        return;
    const uid = pageData;
    const btn1 = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
    btn1.dataset.id = uid;
    btn1.dataset.type = "member";
    const btn2 = createButton(["Btn-StatVoter", "Button--primary"], "粉丝");
    btn2.dataset.id = uid;
    btn2.dataset.qname = "athid";
    const btn3 = createButton(["Btn-StatVoter", "Button--primary"], "赞谁");
    btn3.dataset.id = uid;
    btn3.dataset.qname = "uid";
    const btn4 = createButton(["Btn-AutoActSpider", "Button--primary"], "爬");
    btn4.dataset.id = uid;
    const btn5 = createButton(["Btn-ShowTime", "Button--primary"], "时间图");
    btn5.dataset.id = uid;
    btn5.dataset.qname = "uid";
    if (!header.hasChild(".ProfileButtonGroup"))
        $(".ProfileHeader-contentFooter", header).append(makeElement("div", ["MemberButtonGroup", "ProfileButtonGroup", "ProfileHeader-buttons"], null));
    $(".ProfileButtonGroup", header).prepend(btn1, btn2, btn3, btn4, btn5);

    //spider fot follow
    btn4.draggable = true;
    btn4.ondragstart = (ev) =>
    {
        ev.dataTransfer.setData("text", "spider");
    }
    $("body").on("dragover", "a.NumberBoard-item", ev => ev.preventDefault());
    $("body").on("drop", "a.NumberBoard-item", async ev =>
    {
        ev.preventDefault();
        /**@type {string}*/
        const txt = ev.originalEvent.dataTransfer.getData("text");
        if (txt != "spider" && !Number(txt)) return;
        let cnt = Number(txt) || Number(ev.currentTarget.innerText.split('\n')[1].replace(',', ''));
        console.log("spider for follow", ev);
        const suffix = ev.currentTarget.href.split("/").pop();
        let ret = null;
        if (suffix === "following")
            ret = await ContentBase.fetchFollows("followees", uid, cnt);
        else if (suffix === "followers")
            ret = await ContentBase.fetchFollows("followers", uid, cnt);
        else
            return;
        ContentBase._report("follow", ret);
    });

    PageBase.setUserStatusColor(await ContentBase.checkSpam("users", uid), btn1, uid);
}

async function qstEnhance()
{
    const qstArea = $("div.QuestionHeader-footer-inner").find("div.QuestionButtonGroup")
    if (qstArea.length > 0)
    {
        const qid = ContentBase.CUR_QUESTION;
        const btn = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
        btn.dataset.id = qid;
        btn.dataset.type = "question";
        const btn2 = createButton(["Btn-StatVoter", "Button--primary"], "最爱赞");
        btn2.dataset.id = qid;
        btn2.dataset.qname = "qid";
        const btn3 = createButton(["Btn-AssocAns", "Button--primary"], "启发");
        btn3.dataset.id = qid;
        btn3.dataset.qname = "qid";
        const btn4 = createButton(["Btn-ShowTime", "Button--primary"], "时间图");
        btn4.dataset.id = qid;
        btn4.dataset.qname = "qid";
        qstArea.prepend(btn);
        qstArea.prepend(btn2);
        qstArea.prepend(btn3);
        qstArea.prepend(btn4);
    }

    const qstBoard = $(".NumberBoard")[0];
    if (qstBoard)
    {
        const athid = pageData.author.urlToken;
        const athname = pageData.author.name;
        const bdItem = makeElement("div", "NumberBoard-item", null,
            ["div", "NumberBoard-itemInner", null,
                ["div", "NumberBoard-itemName", null, "提问者"],
                ["a", "NumberBoard-itemValue", { href: `https://www.zhihu.com/people/${athid}`, dataset: { tooltip: athname, tooltipPosition: "right" } },
                    ["img", ["Avatar", "Avatar--large", "UserLink-avatar"], { src: pageData.author.avatarUrl, alt: athname, title: athname, width: "25", height: "25" } ]
                ]
            ]);
        qstBoard.append(bdItem);
        if (athid)
            PageBase.setUserStatusColor(await ContentBase.checkSpam("users", athid), bdItem, athid);
    }

    const qstHead = $(".QuestionHeader")[0];
    qstHead.ondragover = ev => ev.preventDefault();
    qstHead.ondrop = saveQuestion;
}

function reportEnhance()
{
    console.log("report-result page");

    /**
     * @param {HTMLElement[]} feedbackNodes
     */
    function addQuickCheckBtns(feedbackNodes)
    {
        feedbackNodes.filter(node => !node.hasChild(".Btn-QCheckStatus"))
            .forEach(node =>
            {
                const hrefNode = Array.from(node.children[1].querySelectorAll("a"))
                    .filter(aNode => aNode.href.includes("/people/"))[0];
                if (!hrefNode)
                    return;
                const btnNode = node.children[2];
                const btn = createButton(["Btn-QCheckStatus"], "检测");
                btn.dataset.id = hrefNode.href.split("/").pop();
                btn.dataset.name = hrefNode.text;
                btnNode.insertBefore(btn, btnNode.children[1]);
            });
    }

    const bodyObserver = new MutationObserver(records =>
    {
        const addNodes = Array.fromArray(records
            .map(record => $.makeArray(record.addedNodes)
                .filter(node => node instanceof HTMLDivElement)
            ));
        const feedbackNodes = $(addNodes).filter(".zm-pm-item").toArray()
            .filter(ele => ele.dataset.name === "知乎管理员" && ele.dataset.type === "feedback");
        if (feedbackNodes.length > 0)
            addQuickCheckBtns(feedbackNodes);
    });
    async function onChkStatus(e)
    {
        const btn = e.target;
        const uid = btn.dataset.id;
        const user = await ContentBase.checkUserState(uid, undefined, [250], true);
        if (!user)
            return;
        if (user.status === "ban" || user.status === "sban")
            btn.style.background = "black";
        else
            btn.style.background = "rgb(0,224,32)";
    }
    $("body").on("click", "button.Btn-QCheckStatus", onChkStatus);

    const chkAll = createButton(["Btn-QCheckStatusAll"], "检测全部");
    chkAll.addEventListener("click", async ()=>
    {
        if(chkAll.dataset.isChecking === "true")
        {     
            chkAll.dataset.isChecking = "false";
            return;
        }
        chkAll.dataset.isChecking = "true";
        try
        {
            /**@type {HTMLButtonElement[]}*/
            const btns = $("button.Btn-QCheckStatus", document).toArray()
                .filter(x => x.style.background === "");
            for (let i = 0; i < btns.length && chkAll.dataset.isChecking === "true"; ++i)
            {
                chkAll.textContent = btns[i].dataset.name;
                await Promise.all([onChkStatus({ target: btns[i] }), _sleep(1200)]);
            }
        }
        finally
        {
            chkAll.dataset.isChecking = "false";
            chkAll.textContent = "检测全部";
        }
    });
    {
        const dummydiv = makeElement("div", [], { style: { textAlign: "center" } }, chkAll);
        $("#zh-pm-detail-item-wrap").prepend(dummydiv);
    }

    const svgTrash = createSVG(24, 24, "0 0 512 512",
        "M341,128V99c0-19.1-14.5-35-34.5-35H205.4C185.5,64,171,79.9,171,99v29H80v32h9.2c0,0,5.4,0.6,8.2,3.4c2.8,2.8,3.9,9,3.9,9  l19,241.7c1.5,29.4,1.5,33.9,36,33.9h199.4c34.5,0,34.5-4.4,36-33.8l19-241.6c0,0,1.1-6.3,3.9-9.1c2.8-2.8,8.2-3.4,8.2-3.4h9.2v-32  h-91V128z M192,99c0-9.6,7.8-15,17.7-15h91.7c9.9,0,18.6,5.5,18.6,15v29H192V99z M183.5,384l-10.3-192h20.3L204,384H183.5z   M267.1,384h-22V192h22V384z M328.7,384h-20.4l10.5-192h20.3L328.7,384z",
        { fill: "#000" });
    const chkAll2 = makeElement("button", "FeedbackButton-button-3waL", { title:"检测全部", style:{ bottom: "120px" } });
    chkAll2.appendChild(svgTrash);
    chkAll2.addEventListener("click", ()=>{ chkAll.click(); });
    {
        const dummydiv = makeElement("span", [], null, ["div", [], null, chkAll2]);
        $("body").append(dummydiv);
    }

    const curNodes = $(".zm-pm-item", document).toArray();
    addQuickCheckBtns(curNodes);
    bodyObserver.observe(document.body, { "childList": true, "subtree": true });
}

!function ()
{
    const url = window.location.href;
    const mthResp = url.match(/www.zhihu.com\/inbox\/\8912224000/i);
    const mthQst = url.match(/zhihu.com\/question\/(\d*)/i);
    const mthArt = url.match(/zhuanlan.zhihu.com\/p\/(\d*)/i);
    const mthUser = url.match(/www.zhihu.com\/(?:org|people)\/([^\/\?]+)/i);
    const mthMain = url.match(/zhihu.com\/?$/i);
    if (mthResp)
    {
        pageType = "report";
        document.addEventListener("DOMContentLoaded", reportEnhance);
        return;
    }
    if (mthQst)
        pageType = "question", ContentBase.CUR_QUESTION = Number(mthQst[1]);
    else if (mthArt)
        pageType = "article";
    else if (mthUser)
        pageType = "people", pageData = mthUser[1];
    else if (mthMain)
        pageType = "main";
    else
        return;

    console.log(pageType + " page");
    
    const obs = new MutationObserver(records =>
    {
        if (document.body == null)
            return;
        const obj = rootFinder(records);
        if (!obj)
        {
            const oldobj = document.querySelector("#preloadedState");
            if (pageType === "article" && oldobj)
            {
                obs.disconnect();
                processArticleOld(obj);
            }
            else
                return;
        }
        obs.disconnect();
        onObjFound(obj);
    });
    obs.observe(document, { "childList": true, "subtree": true });
   
}()


async function saveQuestion(ev)
{
    ev.preventDefault();
    /**@type {string}*/
    const txt = ev.dataTransfer.getData("text");
    if (txt != "MarkBtn") return;
    const qid = document.location.pathname.split("/")[2];
    if (!qid)
        return;
    const qsturl = `https://www.zhihu.com/api/v4/questions/${qid}?include=excerpt,content,author,answer_count,topics,comment_count,follower_count;data[*].author.voteup_count,answer_count,articles_count,follower_count,badge[?(type=best_answerer)].topics`
    const anspms = ContentBase.fetchAnswers(qid, 100);
    const qst = await ContentBase._get(qsturl);
    qst.answers = await anspms;

    const output = new StandardDB();
    qst.answers.forEach(ans => APIParser.parseByType(output, ans));
    APIParser.parseByType(output, qst);
    output.selfMerge();
    ContentBase._report("batch", output);

    const time = new Date().Format("yyyyMMdd-hhmm");
    const fname = `Question-${qid}-${time}.json`;
    console.log("question fetched", qst);
    if (!ev.ctrlKey)
    {
        return SendMsgAsync({ action: "download", data: qst, type: "json", fname: fname });
    }

    let imgset = new Set();
    qst.answers.forEach(ans =>
    {
        const mths = ans.content.match(/<img [^>]*>/g);
        if (!mths) return;
        mths.map(img => img.match(/data-original="([^"]*)"/i)).filter(mth => mth)
            .forEach(mth => imgset.add(mth[1]));
    });
    saveWithImg(qst, imgset, fname);
}

async function saveADetail(target, id)
{
    const adeturl = `https://www.zhihu.com/api/v4/${target}s/${id}?include=excerpt,content,author,comment_count,voteup_count;data[*].question.answer_count,topics,follower_count;data[*].author.voteup_count,answer_count,articles_count,follower_count,badge[?(type=best_answerer)].topics`
    const adet = await ContentBase._get(adeturl);

    const output = new StandardDB();
    APIParser.parseByType(output, adet);
    ContentBase._report("batch", output);

    const time = new Date().Format("yyyyMMdd-hhmm");
    const fname = `${target}-${id}-${time}.json`;
    console.log(`${target} fetched`, adet);

    let imgset = new Set();
    const mths = adet.content.match(/<img [^>]*>/g);
    if (mths)
        mths.map(img => img.match(/data-original="([^"]*)"/i)).filter(mth => mth)
            .forEach(mth => imgset.add(mth[1]));

    saveWithImg(adet, imgset, fname);
}

async function saveWithImg(base, imgset, fname)
{
    const imgs = imgset.toArray();
    console.log(imgs);
    let jsonpart = [JSON.stringify(base).slice(0, -1), ',"images":{'];//use raw string, avoid crash in JSON.stringify
    for (let idx = 0, pidx = 1; idx < imgs.length; idx += 50)//fetch 50 images at a time, avoid timeout and 409
    {
        if (idx > pidx * 300)//split to multiple part, avoid too large for a string
        {
            jsonpart.push('');
            pidx++;
        }
        await Promise.all(imgs.slice(idx, idx + 50)
            .map(async img =>
            {
                const b64 = await toBase64Img(fetch(img), img);
                const imgname = img.split("/").pop();
                jsonpart[pidx] += `"${imgname}":"${b64}",`;
            }));
        console.log("finish cycle", idx);
    }
    jsonpart[jsonpart.length - 1] = jsonpart[jsonpart.length - 1].slice(0, -1);
    jsonpart.push("}}");
    const blob = new Blob(jsonpart, { type: "application/json" });
    const dataurl = URL.createObjectURL(blob);
    console.log("data with images backuped", base);
    SendMsgAsync({ action: "download", data: dataurl, type: "ObjectURL", fname: fname });
}