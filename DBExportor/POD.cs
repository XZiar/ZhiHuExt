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
            unsafe public  int GetHashCode2(byte[] obj)
            {
                //tHC++; tAll++;
                unchecked
                {
                    var initVal = new uint[4] { _prime0 + _prime1, _prime1, 0, uint.MaxValue - _prime0 };
                    uint h = (uint)obj.Length;
                    fixed (byte* src = obj)
                    {
                        int pos = 0, limit = obj.Length - 16;
                        for (; pos <= limit; pos += 16)
                        {
                            uint* iptr = (uint*)&src[pos];
                            for (var y = 0; y < 4; ++y)
                            {
                                initVal[y] = ((initVal[y] + iptr[y] * _prime1) << 13) * _prime0;
                            }
                        }
                        if (h > 16)
                            h += (initVal[0] << 1) + (initVal[1] << 7) + (initVal[2] << 12) + (initVal[3] << 18);
                        else
                            h += _prime4;
                        limit = obj.Length - 4;
                        for (; pos <= limit; pos += 4)
                        {
                            uint val = *(uint*)&src[pos];
                            h = ((h + _prime2 * val) << 17) * _prime3;
                        }
                        for (; pos < obj.Length; ++pos)
                        {
                            uint val = src[pos];
                            h = ((h + _prime4 * val) << 11) * _prime0;
                        }
                    }
                    h ^= h >> 15;
                    h *= _prime1;
                    h ^= h >> 13;
                    h *= _prime2;
                    h ^= h >> 16;
                    return (int)h;
                }

            }
        }
        private static readonly Dictionary<byte[], uint> Mapper = new Dictionary<byte[], uint>(100000, new ByteStringComparer());
        private static readonly List<byte[]> Cache = new List<byte[]>(100000);
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
        public string from { get => from_; set => from_ = string.Intern(value); }
        [JsonIgnore]
        private string from_;
        public string to { get => to_; set => to_ = string.Intern(value); }
        [JsonIgnore]
        private string to_;
    }

    public enum UserStatus : byte { ban, sban, empty }
    public struct User
    {
        //public string id { get => id_; set => id_ = string.Intern(value); }
        //private string id_;
        public string name;
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
        private UserStatus status_;
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
        public int question;
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
    
    public class StandardDB
    {
        public List<Spam> spams = new List<Spam>();
        public List<Follow> follows = new List<Follow>();
        public List<User> users = new List<User>();
        public List<Question> questions = new List<Question>();
        public List<Article> articles = new List<Article>();
        public List<Topic> topics = new List<Topic>();
        public List<Answer> answers = new List<Answer>();
        public List<Zan> zans = new List<Zan>();
        public List<Zan> zanarts = new List<Zan>();
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
                break;
            }
        }
    }

    [AttributeUsage(AttributeTargets.Struct, AllowMultiple = false)]
    public sealed class PodAttribute : Attribute
    {
        public readonly string[] TableNames;
        public PodAttribute(params string[] tableName)
        {
            TableNames = tableName;
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
