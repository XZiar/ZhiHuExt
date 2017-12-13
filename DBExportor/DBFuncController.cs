using DBExportor.Pods;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;

namespace DBExportor.Controllers
{

    [Route("dbfunc")]
    public class DBFuncController : ControllerBase
    {
        private readonly ILogger<DBFuncController> LOG;

        public DBFuncController(ILogger<DBFuncController> logger)
        {
            LOG = logger;
        }

        private Dictionary<string, object> BuildCache(StandardDB db)
        {
            Console.WriteLine($"building cache for {ObjName}");
            var caches = new Dictionary<string, object>();
            {
                Dictionary<uint, int> uidcache = new Dictionary<uint, int>();
                HashSet<uint> banuid = new HashSet<uint>();
                int idx = 0;
                foreach (var user in db.users)
                {
                    uidcache[user.id_] = idx++;
                    if (user.status_ == UserStatus.ban || user.status_ == UserStatus.sban)
                        banuid.Add(user.id_);
                }
                caches["uid-user"] = uidcache;
                caches["banuid"] = banuid;
                LOG.LogInformation($"user's index cache built");
            }
            {
                caches["from-zan"] = db.zans.Zip(Enumerable.Range(0, db.zans.Count), (zan, idx) => (zan.from_, idx)).ToLookup(x => x.from_, x => x.idx);
                caches["to-zan"] = db.zans.Zip(Enumerable.Range(0, db.zans.Count), (zan, idx) => (zan.to, idx)).ToLookup(x => x.to, x => x.idx);
                LOG.LogInformation($"zanart's index cache built");

                caches["from-zanart"] = db.zanarts.Zip(Enumerable.Range(0, db.zanarts.Count), (zan, idx) => (zan.from_, idx)).ToLookup(x => x.from_, x => x.idx);
                caches["to-zanart"] = db.zanarts.Zip(Enumerable.Range(0, db.zanarts.Count), (zan, idx) => (zan.to, idx)).ToLookup(x => x.to, x => x.idx);
                LOG.LogInformation($"zanart's index cache built");
            }
            {
                var dict1 = db.answers.ToDictionary(ans => ans.id, ans => ans.author_);
                caches["ans-author"] = dict1;
                caches["author-ans"] = dict1.ToLookup(kv => kv.Value, kv => kv.Key);
                LOG.LogInformation($"answer's index cache built");
                var dict2 = db.articles.ToDictionary(art => art.id, art => art.author_);
                caches["art-author"] = dict2;
                caches["author-art"] = dict1.ToLookup(kv => kv.Value, kv => kv.Key);
                LOG.LogInformation($"article's index cache built");
            }
            GC.Collect(2, GCCollectionMode.Optimized, false, true);
            return caches;
        }

        [HttpGet("begin")]
        public IActionResult BeginDB()
        {
            if (string.IsNullOrEmpty(ObjName))
                return StatusCode(404);
            if (TryGetDB(out var olddb))
                return Ok("ok");
            var fname = $"{Program.DBFolder}/ZhiHuExtDB-{ObjName}.json";
            using (var reader = new JsonTextReader(new StreamReader(System.IO.File.OpenRead(fname))))
            {
                try
                {
                    var db = SlimSerializer.Deserialize<StandardDB>(reader);
                    LOG.LogInformation("json loaded");
                    db.Slim(1);
                    GC.Collect(2, GCCollectionMode.Optimized, false, true);
                    var cache = BuildCache(db);
                    if (!NewCache(cache) || !NewDB(db)) 
                        return StatusCode(500);
                }
                catch (Exception e)
                {
                    LOG.LogError(e.Message, e.StackTrace);
                    return StatusCode(500);
                }
            }
            GC.Collect(2, GCCollectionMode.Optimized, false, true);
            return Ok("ok");
        }

        private User[] GetUsers(StandardDB db, Dictionary<string, object> cache, string[] uids)
        {
            var uidcache = cache["uid-user"] as Dictionary<uint, int>;
            return uids.Select(uid => UIDPool.Get(uid)).Where(uid => uid != uint.MaxValue)
                .Select(uid => uidcache.TryGetValue(uid, out var idx) ? idx : -1).Where(x => x >= 0)
                .Select(idx => db.users[idx]).ToArray();
        }

        [HttpPost("getAny")]
        public IActionResult DoGetAny()
        {
            if (!TryGetDB(out var db))
                return StatusCode(404);
            if (!TryGetCache(out var cache))
                return StatusCode(404);

            string[] uids;
            using (var reader = new JsonTextReader(new StreamReader(HttpContext.Request.Body)))
            {
                try
                {
                    var args = Serializer.Deserialize<string[]>(reader);
                    if (args[0] == "users" && args[1] == "id")
                        uids = JsonConvert.DeserializeObject<string[]>(args[2]);
                    else if(args[0] == "banzan")
                    {
                        var zanfcache = cache["from-zan"] as ILookup<uint, int>;
                        var zanartfcache = cache["from-zanart"] as ILookup<uint, int>;
                        var banuid = cache["banuid"] as HashSet<uint>;
                        var zansum = banuid.SelectMany(uid => zanfcache[uid]).Count();
                        var zanartsum = banuid.SelectMany(uid => zanartfcache[uid]).Count();
                        return Ok(zansum + zanartsum);
                    }
                    else
                        return StatusCode(500);
                }
                catch (Exception e)
                {
                    LOG.LogError(e.Message);
                    return StatusCode(500);
                }
            }
            HttpContext.Response.ContentType = "text/plain; charset=utf-8";
            using (var writer = new JsonTextWriter(new StreamWriter(HttpContext.Response.Body)))
            {
                try
                {
                    var ret = GetUsers(db, cache, uids);
                    Serializer.Serialize(writer, ret);
                    GC.Collect(2, GCCollectionMode.Optimized, false, true);
                }
                catch (Exception e)
                {
                    LOG.LogError(e.Message);
                    return StatusCode(500);
                }
                GC.Collect(2, GCCollectionMode.Optimized, false, true);
                return new EmptyResult();
            }
        }

        private string[][] GetZanLinks(StandardDB db, Dictionary<string, object> cache, string[] uids, string target)
        {
            Console.WriteLine($"here get {uids.Length} uids");
            if (target == "to")
            {
                var zanfcache = cache["from-zan"] as ILookup<uint, int>;
                var zanartfcache = cache["from-zanart"] as ILookup<uint, int>;
                var ansathcache = cache["ans-author"] as Dictionary<uint, uint>;
                var artathcache = cache["art-author"] as Dictionary<uint, uint>;

                var zanans = uids.SelectMany(uid =>
                {
                    var id = UIDPool.Get(uid);
                    if (id == uint.MaxValue)
                        return Enumerable.Empty<string[]>();
                    return zanfcache[id].Select(idx =>
                    {
                        ansathcache.TryGetValue(db.zans[idx].to, out var ath);
                        return new string[] { uid, UIDPool.GetString(ath) };
                    });
                }).Where(pair => pair[1] != null);
                var zanart = uids.SelectMany(uid =>
                {
                    var id = UIDPool.Get(uid);
                    if (id == uint.MaxValue)
                        return Enumerable.Empty<string[]>();
                    return zanartfcache[id].Select(idx =>
                    {
                        artathcache.TryGetValue(db.zanarts[idx].to, out var ath);
                        return new string[] { uid, UIDPool.GetString(ath) };
                    });
                }).Where(pair => pair[1] != null);
                return zanans.Concat(zanart).ToArray();
            }
            else if (target == "from")
            {
                var athanscache = cache["author-ans"] as ILookup<uint, uint>;
                var athartcache = cache["author-art"] as ILookup<uint, uint>;
                var zantcache = cache["to-zan"] as ILookup<uint, int>;
                var zanarttcache = cache["to-zanart"] as ILookup<uint, int>;

                var zanans = uids.SelectMany(uid =>
                {
                    var id = UIDPool.Get(uid);
                    if (id == uint.MaxValue)
                        return Enumerable.Empty<string[]>();
                    return athanscache[id].SelectMany(ansid => zantcache[ansid])
                        .Select(idx => new string[] { db.zans[idx].from, uid });
                });
                var zanart = uids.SelectMany(uid =>
                {
                    var id = UIDPool.Get(uid);
                    if (id == uint.MaxValue)
                        return Enumerable.Empty<string[]>();
                    return athanscache[id].SelectMany(artid => zanarttcache[artid])
                        .Select(idx => new string[] { db.zanarts[idx].from, uid });
                });
                return zanans.Concat(zanart).ToArray();
            }
            else return null;
        }

        [HttpPost("getZanLinks")]
        public IActionResult DoGetZanLinks()
        {
            if (!TryGetDB(out var db))
                return StatusCode(404);
            if (!TryGetCache(out var cache))
                return StatusCode(404);

            string target;
            string[] uids;
            using (var reader = new JsonTextReader(new StreamReader(HttpContext.Request.Body)))
            {
                try
                {
                    var args = Serializer.Deserialize<string[]>(reader);
                    target = args[1];
                    uids = JsonConvert.DeserializeObject<string[]>(args[0]);
                }
                catch (Exception e)
                {
                    LOG.LogError(e.Message);
                    return StatusCode(500);
                }
            }
            HttpContext.Response.ContentType = "text/plain; charset=utf-8";
            using (var writer = new JsonTextWriter(new StreamWriter(HttpContext.Response.Body)))
            {
                try
                {
                    var ret = GetZanLinks(db, cache, uids, target);
                    Serializer.Serialize(writer, ret);
                    GC.Collect(2, GCCollectionMode.Optimized, false, true);
                }
                catch (Exception e)
                {
                    LOG.LogError(e.Message);
                    return StatusCode(500);
                }
                GC.Collect(2, GCCollectionMode.Optimized, false, true);
                return new EmptyResult();
            }
        }
    }
}