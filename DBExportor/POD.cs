using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;

namespace DBExportor.Pods
{
    public static class UIDPool
    {
        private const uint _prime0 = 2654435761U, _prime1 = 2246822519U, _prime2 = 3266489917U, _prime3 = 668265263U, _prime4 = 374761393U;
        private static ulong tEQ = 0, tHC = 0, tAll;
        public class ByteStringComparer : EqualityComparer<byte[]>
        {
            unsafe public override bool Equals(byte[] x, byte[] y)
            {
                if (x == null || y == null)
                    return x == y;
                //tEQ++; tAll++;
                fixed (byte* sx = x)
                {
                    fixed (byte* sy = y)
                    {
                        int lx = x.Length, ly = y.Length;
                        if(lx != ly)
                            return false;
                        uint* px = (uint*)sx, py = (uint*)sy;
                        int pos = 0, lim = lx - 4;
                        for (; pos <= lim; pos+=4)
                        {
                            if (*px++ != *py++)
                                return false;
                        }
                        for (; pos < lx; ++pos)
                        {
                            if (sx[pos] != sy[pos])
                                return false;
                        }
                    }
                }
                return true;
            }
            unsafe public override int GetHashCode(byte[] obj)
            {
                ///tHC++; tAll++;
                unchecked
                {
                    fixed (byte* src = obj)
                    {
                        int pos = 0, limit = obj.Length;
                        uint h = 2166136261u;
                        while (pos < limit)
                            h = (h ^ src[pos++]) * 16777619;
                        return (int)h;
                    }
                }
            }
        }
        private static readonly Dictionary<byte[], uint> Mapper = new Dictionary<byte[], uint>(3000000, new ByteStringComparer());
        private static readonly List<byte[]> Cache = new List<byte[]>(3000000);
        static UIDPool()
        {
            Cache.Add(null);
        }
        public static uint GetOrNew(string uid)
        {
            if (uid == null)
                return 0;
            var ba = System.Text.Encoding.UTF8.GetBytes(uid);
            if (Mapper.TryGetValue(ba, out var id))
                return id;
            id = (uint)Cache.Count;
            Cache.Add(ba);
            Mapper[ba] = id;
            return id;
        }
        public static uint Get(string uid)
        {
            if (uid == null)
                return 0;
            var ba = System.Text.Encoding.UTF8.GetBytes(uid);
            if (Mapper.TryGetValue(ba, out var id))
                return id;
            return uint.MaxValue;
        }
        public static string GetString(uint id)
        {
            if (id == 0)
                return null;
            return System.Text.Encoding.UTF8.GetString(Cache[(int)id]);
        }
    }

    public enum SpamType : byte { member, answer, article, question, badans, badart, badusr }
    public struct Spam
    {
        public string id { get => UIDPool.GetString(id_); set => id_ = UIDPool.GetOrNew(value); }
        [JsonIgnore]
        internal uint id_;
        public string type { get => type_.ToString(); set { type_ = Enum.Parse<SpamType>(value); } }
        [JsonIgnore]
        private SpamType type_;
    }

    public struct Follow
    {
        public string from { get => UIDPool.GetString(from_); set => from_ = UIDPool.GetOrNew(value); }
        [JsonIgnore]
        private uint from_;
        public string to { get => UIDPool.GetString(to_); set => to_ = UIDPool.GetOrNew(value); }
        [JsonIgnore]
        private uint to_;
    }

    public enum UserStatus : byte { ban, sban, empty }
    public struct User
    {
        public string name;
        public string hl;
        public string loc;
        public string des;
        public string head
        {
            get => head_ == null ? null : System.Text.Encoding.UTF8.GetString(head_);
            set => head_ = value == null ? null : System.Text.Encoding.UTF8.GetBytes(value);
        }
        [JsonIgnore]
        private byte[] head_;
        public string status
        {
            get => status_ == UserStatus.empty ? "" : status_.ToString();
            set => status_ = Enum.TryParse<UserStatus>(value, out var res) ? res : UserStatus.empty;
        }
        public string id { get => UIDPool.GetString(id_); set => id_ = UIDPool.GetOrNew(value); }
        [JsonIgnore]
        internal uint id_;
        public int anscnt;
        public int artcnt;
        public int zancnt;
        public int follower;
        [JsonIgnore]
        internal UserStatus status_;
    }

    public struct Question
    {
        public uint id;
        public string title;
        public int[] topics;
        public long timeC { get => timeC_ == uint.MaxValue ? -1L : timeC_; set => timeC_ = value == -1 ? uint.MaxValue : (uint)value; }
        [JsonIgnore]
        private uint timeC_;
    }

    public struct Article
    {
        public uint id;
        public string author { get => UIDPool.GetString(author_); set => author_ = UIDPool.GetOrNew(value); }
        [JsonIgnore]
        internal uint author_;
        public int zancnt;
        public long timeC { get => timeC_ == uint.MaxValue ? -1L : timeC_; set => timeC_ = value == -1 ? uint.MaxValue : (uint)value; }
        [JsonIgnore]
        private uint timeC_;
        public long timeU { get => timeU_ == uint.MaxValue ? -1L : timeU_; set => timeU_ = value == -1 ? uint.MaxValue : (uint)value; }
        [JsonIgnore]
        private uint timeU_;
        public string title;
        public string excerpt;
    }

    public struct Topic
    {
        public uint id;
        public string name;
    }

    public struct Answer
    {
        public uint id;
        public string author { get => UIDPool.GetString(author_); set => author_ = UIDPool.GetOrNew(value); }
        [JsonIgnore]
        internal uint author_;
        public uint question;
        public int zancnt;
        public long timeC { get => timeC_ == uint.MaxValue ? -1L : timeC_; set => timeC_ = value == -1 ? uint.MaxValue : (uint)value; }
        [JsonIgnore]
        private uint timeC_;
        public long timeU { get => timeU_ == uint.MaxValue ? -1L : timeU_; set => timeU_ = value == -1 ? uint.MaxValue : (uint)value; }
        [JsonIgnore]
        private uint timeU_;
        public string excerpt;
    }

    public struct Zan
    {
        public string from { get => UIDPool.GetString(from_); set => from_ = UIDPool.GetOrNew(value); }
        [JsonIgnore]
        internal uint from_;
        public uint to;
        public long time { get => time_ == uint.MaxValue ? -1L : time_; set => time_ = value == -1 ? uint.MaxValue : (uint)value; }
        [JsonIgnore]
        private uint time_;
    }

    public struct ADetail
    {
        public int id;
        public string content;
    }

    public struct RecItem
    {
        public string id;
        public uint told;
    }

    public class StandardDB
    {
        public List<Spam> spams = new List<Spam>();
        public List<Follow> follows = new List<Follow>();
        public List<User> users = new List<User>(4500000);
        public List<Question> questions = new List<Question>();
        public List<Article> articles = new List<Article>();
        public List<Topic> topics = new List<Topic>();
        public List<Answer> answers = new List<Answer>(2000000);
        public List<Zan> zans = new List<Zan>(23000000);
        public List<Zan> zanarts = new List<Zan>(2000000);
        public List<Zan> followqsts = new List<Zan>(100000);
        public List<ADetail> details = new List<ADetail>(1500000);
        public List<RecItem> rectime = new List<RecItem>();
        public void Slim(int level = 0)
        {
            switch(level)
            {
            case 1:
                users.ForEach(u => u.head = null);
                goto case 0;
            case 0:
                answers.ForEach(a => a.excerpt = null);
                articles.ForEach(a => a.excerpt = null);
                details.Clear();
                rectime.Clear();
                break;
            }
        }
    }

    public class TableInfo
    {
        private readonly FieldInfo Field;
        private readonly PropertyInfo CountProperty;
        public readonly Type ElementType;
        public readonly Type ListType;
        public TableInfo(FieldInfo field)
        {
            Field = field;
            ListType = field.FieldType;
            ElementType = ListType.GetGenericArguments()[0];
            CountProperty = ListType.GetProperty("Count");
        }
        public dynamic GetTable(StandardDB db) => Field.GetValue(db);
        public uint GetCount(dynamic table) => (uint)CountProperty.GetValue(table);
    }

    public static class DBExtensions
    {
        public const string POD_VER = "171115a";

        public static readonly Dictionary<string, TableInfo> PodTypeMap =
            typeof(StandardDB).GetFields().ToDictionary(field => field.Name, field => new TableInfo(field));
    }
}
