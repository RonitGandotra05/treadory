using System.Security.Cryptography;
using System.Text.Json;
namespace Treadory;
internal sealed record AppSettings(int Version, Dictionary<string,string> Mappings, string? DriverHash)
{
    internal static AppSettings Default => new(1,Engine.Controls.ToDictionary(c=>c,_=>"none"),null);
    internal void Validate()
    {
        if(Version!=1||Mappings==null||Mappings.Count!=3||!Engine.Controls.All(c=>Mappings.TryGetValue(c,out var a)&&Engine.Actions.Contains(a)))throw new InvalidDataException("Invalid saved pedal actions.");
        if(DriverHash!=null&&!System.Text.RegularExpressions.Regex.IsMatch(DriverHash,"^[a-fA-F0-9]{64}$"))throw new InvalidDataException("Invalid driver checksum.");
    }
}
internal static class SettingsStore
{
    internal static AppSettings Load(string path)
    {
        if(!File.Exists(path))return AppSettings.Default;
        if(new FileInfo(path).Length>8192)throw new InvalidDataException("Settings file is too large.");
        var value=JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(path),new JsonSerializerOptions {UnmappedMemberHandling=System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow})??throw new InvalidDataException("Empty settings.");value.Validate();return value;
    }
    internal static void Save(string path,AppSettings value)
    {
        value.Validate();Directory.CreateDirectory(Path.GetDirectoryName(path)!);var temporary=path+".tmp";
        try {File.WriteAllText(temporary,JsonSerializer.Serialize(value));File.Move(temporary,path,true);} finally {if(File.Exists(temporary))File.Delete(temporary);}
    }
}
internal static class DriverFile
{
    internal static byte[] Verify(string source,string expected,bool consent)
    {
        if(!consent||!System.Text.RegularExpressions.Regex.IsMatch(expected,"^[a-fA-F0-9]{64}$"))throw new InvalidDataException("Accept your applicable driver license and supply the independently verified SHA-256.");
        if(new FileInfo(source).Length is < 64 or > 10_000_000)throw new InvalidDataException("Invalid DLL size.");
        var bytes=File.ReadAllBytes(source);var actual=Convert.ToHexString(SHA256.HashData(bytes));
        if(!actual.Equals(expected,StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("DLL checksum does not match. Nothing imported.");
        var pe=BitConverter.ToInt32(bytes,0x3c);
        if(bytes[0]!='M'||bytes[1]!='Z'||pe<64||pe>bytes.Length-24||BitConverter.ToUInt32(bytes,pe)!=0x4550||BitConverter.ToUInt16(bytes,pe+4)!=0x8664||(BitConverter.ToUInt16(bytes,pe+22)&0x2000)==0)throw new InvalidDataException("Supply the official x64 Interception DLL, not an installer or another architecture.");
        return bytes;
    }
    internal static void Import(string source,string destination,string expected,bool consent)
    {
        var bytes=Verify(source,expected,consent);if(File.Exists(destination))throw new IOException("A DLL already exists beside the EXE. Restart after removing it; existing integrations are never overwritten.");
        using var file=new FileStream(destination,FileMode.CreateNew,FileAccess.Write,FileShare.None);file.Write(bytes);
    }
}
