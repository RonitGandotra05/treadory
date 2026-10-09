using System.Buffers.Binary;
using System.Text.Json;

namespace Treadory;
internal static class Protocol
{
    internal const int MaxBytes = 32768;
    internal static JsonDocument? Read(Stream input)
    {
        Span<byte> header = stackalloc byte[4];
        var first = input.ReadByte(); if (first < 0) return null;
        header[0] = (byte)first; input.ReadExactly(header[1..]);
        var size = BinaryPrimitives.ReadUInt32LittleEndian(header);
        if (size is 0 or > MaxBytes) throw new InvalidDataException("Invalid frame size.");
        var bytes = new byte[size]; input.ReadExactly(bytes);
        return JsonDocument.Parse(bytes, new JsonDocumentOptions { MaxDepth = 8 });
    }
    internal static byte[] Encode(object message)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(message);
        if (bytes.Length > MaxBytes) throw new InvalidDataException("Response too large.");
        var framed = new byte[4 + bytes.Length]; BinaryPrimitives.WriteUInt32LittleEndian(framed, (uint)bytes.Length); bytes.CopyTo(framed, 4); return framed;
    }
    internal static int Id(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty("version", out var v) || v.GetInt32() != 1 || !value.TryGetProperty("id", out var id) || !id.TryGetInt32(out var number) || number < 1) throw new InvalidDataException("Invalid protocol envelope.");
        return number;
    }
}
