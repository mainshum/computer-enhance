const fs = require("fs");
const [fileName] = process.argv.slice(2);

const buf = fs.readFileSync(fileName, null);

const opcodesMap = {
  100010: "mov",
};

const ensureNonEmptyString =
  (fn) =>
  (...xs) => {
    const retval = fn(...xs);
    if (!retval) throw new Error("decoding failed");

    return retval;
  };

const decodeReg = ensureNonEmptyString((w, reg) => {
  if (w !== "0" && w !== "1") throw new Error("reg decoding failed", w);

  if (w === "0")
    return {
      "000": "al",
      "001": "cl",
      "010": "dl",
      "011": "bl",
      100: "ah",
      101: "ch",
      110: "dh",
      111: "bh",
    }[reg];

  return {
    "000": "ax",
    "001": "cx",
    "010": "dx",
    "011": "bx",
    100: "sp",
    101: "bp",
    110: "si",
    111: "di",
  }[reg];
});

const decodeRm = ensureNonEmptyString((w, mod, rm) => {
  if (mod !== "11" || (w !== "0" && w !== "1"))
    throw new Error(`rm decoding failed: ${w}, ${mod}`);

  if (w === "0")
    return {
      "000": "al",
      "001": "cl",
      "010": "dl",
      "011": "bl",
      100: "ah",
      101: "ch",
      110: "dh",
      111: "bh",
    }[rm];

  return {
    "000": "ax",
    "001": "cx",
    "010": "dx",
    "011": "bx",
    100: "sp",
    101: "bp",
    110: "si",
    111: "di",
  }[rm];
});

const decodeOpcode = (opcode) => opcodesMap[opcode];

const describeBits = (mnemo) => ({
  opcode: mnemo.substr(0, 6),
  d: mnemo[6],
  w: mnemo[7],
  mod: mnemo.substr(8, 2),
  reg: mnemo.substr(10, 3),
  rm: mnemo.substr(13, 3),
});

console.log("bits 16");

for (let k = 0; k < buf.length; k += 2) {
  const { opcode, w, reg, mod, rm, d } = describeBits(
    [buf.at(k), buf.at(k + 1)].map((x) => x.toString(2)).join("")
  );

  // d (direction)=1 then reg is destination, =0 then reg is source

  const regDec = decodeReg(w, reg);
  const rmDec = decodeRm(w, mod, rm);

  const operands = d === "1" ? `${regDec},${rmDec}` : `${rmDec},${regDec}`;

  console.log(`${decodeOpcode(opcode)} ${operands}`);
}
