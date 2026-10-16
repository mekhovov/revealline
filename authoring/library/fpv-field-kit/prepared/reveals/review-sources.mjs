import { reviewText } from './review-copy.mjs';

// Historical inputs only. Listing a source does not admit it into a package.
export const PREPARED_REVEAL_MANIFEST = Object.freeze({
  id: 'manifest',
  kind: 'text',
  path: 'authoring/library/fpv-field-kit/prepared/reveals/reveals.json',
  bytes: 266665,
  sha256: 'fc25cf8c335518bdfd2259e26cb08e99184a9cfcf0c01018063d1b928103f92b',
});
export const PREPARED_REVEAL_GUIDE = Object.freeze({
  ...{
    id: 'guide',
    kind: 'text',
    path: 'docs/field-kit-reveals.md',
    bytes: 4433,
    sha256: '1ab0e701d5b76b6453db8707ff883319a65c000bad5ec915a8c4ea727f11af0d',
  },
  title: () => reviewText('contract'),
});

// Lossless source-pin table: name | base64 SHA-256 | bytes | portrait? | revision?.
// Defaults are the original 1774x887 dimensions and v1; no source is omitted.
export const PREPARED_REVEAL_ORIGINALS = Object.freeze(
  `orchard-window|LwVWFm3ekigDc20GajfBUbXNmHQOUKYw9HU1paysknY=|2290152
homeward-02|hrMDkauDRWlsHNXqS+REB+oHdOa2YpiRNqEVa5jSaPQ=|1948666|p
frayed-causeway-fpv|PLW8aC+WCbEKHmbTBnSxc3+UvwkcE49H499RG8KOC70=|2104183
open-the-circuit|EoquvUAcJ7LdyWmYNRu29BiQry9NUx+r6Hv25ernXec=|1558744
night-signal|9m7U+K1HuoskzBOiN8dLipzMAtaGeLMyYmXEGcCrf+M=|1553271
offset-docks-fpv|QxK7znND+Lm4+cYXxQouyD0kfDI/sBym/j0Ad9J3ecE=|1446784
switchyard-gates|eQry8dgEtvxX9YKmspziTALWLre5QknrKg4nnQ8fVAI=|1798203
homeward-01|jI60VJlqrTAbIaHZO+ceaPooSxuK9LG925Hcv54ZQvQ=|2025730|p
homeward-03|6UFEMyVZch8JcuzuUA6dySrNq26DvkM/9Fx0kqzOPIU=|1543611|p
courtyard-exits|SMQgi76pDtlruTjdvOVTwiVS3JsHvJK50tTsTfSEFiI=|2168740
night-crossfire|9uMi36ukZlwwEAXluZhC1aLJzyxh45wvv+iyUk9fi6U=|1553167
split-courtyard|45kFtAxCt5f8eyXlAEiyOQSQqtkgfpMlnTRivdq21h8=|1815551
listening-court|CyDrmkgWMS9JEx74XeJcoEtmdUYqezf4RO4BoluErks=|1806215
crossing-watch-fpv|EnJx+Nc2QBotGCh/8sFc9CabagBgrACViNzCE9S+r1M=|1309256
orchard-crossing|XvN3VqAaZMgLtHkMUgeio8bqFcd6wgGQJaxVhnkt6Ww=|1859675
split-ring-fpv|H0tyHJnQB+yq7HvaGYEkMQK8JX0HyGrCMga84PKfdqk=|1416684
fault-fan-fpv|Fn5uOf1uUuXltLF4x4+P4uqQuDGFY13gSWX4hCAXeEE=|1870086
split-signal-foundry|YS3ALSYW9lIrtHDVpAbuGCsdGMAioWbK4+Uy37unsrs=|1887208
crosswind-depot|dB8aOFCRrT9/KTlEYCPwuXar6b0h5rKYXPuRmUSBB9U=|1893030
signal-switchback|lm3HRa3geuB4jXhCdb2bWUngbkmmrbme5Hiuj+H+faE=|1590880
sandbar-braid-fpv|D3B1gU5jI0TqbTGLGh2ZpVcOAYbVyT65S+zQ4ukds/4=|1803324
signal-07|sRTrSHqxvEEkSJ/uw2QChYNmPbomd+44qii7Y2dMr1A=|1803960|p
signal-02|j6BAbYaY5cY1xFtdk0vtF2VU7oNGSy3zFMD+ORk5kHM=|1823823|p
signal-04|Ab9illlTNoJEHiOpBsPy7jrWGRZ0mCXnpcOmC6WSBX8=|1629254|p
signal-10|W/A1FgHXyijw2nf7nmoBZN3mcsIbAEVvnHktxz3rPEM=|1950136|p
signal-01|88lcP6C6KH9KeDKYI0/P+mtd/W24/GCoQIDjzZC9br8=|1707488|p
fieldcraft-02|AMvP+4iQej47I1HK19DbqPdPMgZ8c7J/n9PscxeXZpE=|1756307|p
fieldcraft-01|VQjRUnkJ3eyuSoIlPpY4YmLJPa26M/tyWP6xYZpaMbo=|1577074|p
signal-06|tFbR4PrUZ/XPGxjN9yHHuxgdQHMUKj12s8B5B5qrXKQ=|1753604|p|2
sentinel-relay-01|b3kxD7QiHatJPvUGL5eigMBieHRzbb9qTWGUecrdQHE=|1690677|p
signal-09|4UoGgqKsX3V0VpmJXPUognpRjrkdty2I7BGaXTgtE3w=|1935071|p
fieldcraft-03|JObV/SrjCkgdqhV6nEo76KFkNPoMFMtkBroKE6XPeew=|1618571|p
signal-05|XJBNwf65Vz7H+9Pdhcy2aiYyVRFQkss4ue8A/kLiSlQ=|1495178|p
signal-08|zAnCcrul6+ajRfeAoCU/3EZHTo7ObADHQaiguaZIRWY=|1527108|p
fieldcraft-04|CQS1gykoe4gW8Pk3Ptqz5Tpqo50P+NuUq//naWanBK8=|1887979|p
signal-11|X0FWwU9MXqp8oqigyW+IoK+6oEaB/W7gZISyDTcLmzI=|1626259|p
signal-03|FLzNWOlsUmmFR3euNstjdglZmWyxmuxid6NhwG39JvE=|1657477|p
signal-12|QylfAkZ3G9ICGBILzQboICHWQp5edGk6HIJgwj7vh5Y=|1667948|p`
    .split('\n')
    .map((line) => {
      const [name, encodedHash, bytes, portrait, revision = '1'] = line.split('|');
      const source = {
        id: `original-scene-${name}`,
        kind: 'image',
        path: `authoring/library/fpv-field-kit/originals/reveals/scene-${name}-v${revision}.png`,
        sha256: Array.from(atob(encodedHash), (value) =>
          value.charCodeAt(0).toString(16).padStart(2, '0'),
        ).join(''),
        bytes: Number(bytes),
        width: portrait ? 1448 : 1774,
        height: portrait ? 1086 : 887,
      };
      return Object.freeze({
        ...source,
        title: () => reviewText('originalTitle', { id: source.id.slice(9) }),
      });
    }),
);
