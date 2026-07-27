type ZipEntry = {
  name: string;
  content: string | Uint8Array;
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    table[index] = crc >>> 0;
  }

  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

export function buildZip(entries: ZipEntry[]) {
  const localFileParts: Uint8Array[] = [];
  const centralDirectoryParts: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const fileNameBytes = encodeUtf8(entry.name);
    const contentBytes = typeof entry.content === 'string' ? encodeUtf8(entry.content) : entry.content;
    const crc = crc32(contentBytes);

    const localHeader = new Uint8Array(30 + fileNameBytes.length);
    const localHeaderView = new DataView(localHeader.buffer);
    writeUint32(localHeaderView, 0, 0x04034b50);
    writeUint16(localHeaderView, 4, 20);
    writeUint16(localHeaderView, 6, 0x0800);
    writeUint16(localHeaderView, 8, 0);
    writeUint16(localHeaderView, 10, 0);
    writeUint16(localHeaderView, 12, 0);
    writeUint32(localHeaderView, 14, crc);
    writeUint32(localHeaderView, 18, contentBytes.length);
    writeUint32(localHeaderView, 22, contentBytes.length);
    writeUint16(localHeaderView, 26, fileNameBytes.length);
    writeUint16(localHeaderView, 28, 0);
    localHeader.set(fileNameBytes, 30);

    localFileParts.push(localHeader, contentBytes);

    const centralHeader = new Uint8Array(46 + fileNameBytes.length);
    const centralHeaderView = new DataView(centralHeader.buffer);
    writeUint32(centralHeaderView, 0, 0x02014b50);
    writeUint16(centralHeaderView, 4, 20);
    writeUint16(centralHeaderView, 6, 20);
    writeUint16(centralHeaderView, 8, 0x0800);
    writeUint16(centralHeaderView, 10, 0);
    writeUint16(centralHeaderView, 12, 0);
    writeUint16(centralHeaderView, 14, 0);
    writeUint32(centralHeaderView, 16, crc);
    writeUint32(centralHeaderView, 20, contentBytes.length);
    writeUint32(centralHeaderView, 24, contentBytes.length);
    writeUint16(centralHeaderView, 28, fileNameBytes.length);
    writeUint16(centralHeaderView, 30, 0);
    writeUint16(centralHeaderView, 32, 0);
    writeUint16(centralHeaderView, 34, 0);
    writeUint16(centralHeaderView, 36, 0);
    writeUint32(centralHeaderView, 38, 0);
    writeUint32(centralHeaderView, 42, offset);
    centralHeader.set(fileNameBytes, 46);
    centralDirectoryParts.push(centralHeader);

    offset += localHeader.length + contentBytes.length;
  });

  const centralDirectorySize = centralDirectoryParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  const endRecordView = new DataView(endRecord.buffer);
  writeUint32(endRecordView, 0, 0x06054b50);
  writeUint16(endRecordView, 4, 0);
  writeUint16(endRecordView, 6, 0);
  writeUint16(endRecordView, 8, entries.length);
  writeUint16(endRecordView, 10, entries.length);
  writeUint32(endRecordView, 12, centralDirectorySize);
  writeUint32(endRecordView, 16, offset);
  writeUint16(endRecordView, 20, 0);

  const blobParts: BlobPart[] = [...localFileParts, ...centralDirectoryParts, endRecord].map(
    (part) => new Uint8Array(part) as unknown as BlobPart
  );

  return new Blob(blobParts, {
    type: 'application/zip',
  });
}
