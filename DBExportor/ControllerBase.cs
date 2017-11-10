using DBExportor.Pods;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DBExportor.Controllers
{
    public class ControllerBase : Controller
    {
        protected static readonly Dictionary<string, Dictionary<string, object>> DBList = new Dictionary<string, Dictionary<string, object>>();
        protected static readonly JsonSerializer Serializer = new JsonSerializer();

        protected static void AddMore(Dictionary<string, object> dict, string key, dynamic data)
        {
            if (!DBExtensions.PodTypeMap.ContainsKey(key))
                throw new ArgumentException("invalid table name");

            if (dict.TryGetValue(key, out dynamic list))
                list.AddRange(data);
            else
                dict.Add(key, data);
        }

        protected string ObjName { get => HttpContext.Request.Headers["objid"].FirstOrDefault(); }

        protected bool CheckAuth() => HttpContext.Request.Headers["authval"].Contains(Program.Auth);

        protected bool TryGetDB(out Dictionary<string, object> ret) => DBList.TryGetValue(ObjName, out ret);

        protected bool NewDB()
        {
            if (ObjName != null)
                DBList[ObjName] = new Dictionary<string, object>();
            return ObjName != null;
        }

    }
}
