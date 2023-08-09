import { z } from "https://deno.land/x/zod/mod.ts";

const filename = Deno.args[0];
const isDebug = Deno.args[1] == "true" || false;
const bytes = await Deno.readFileSync(filename);

const decodeReg = (w: string, reg: string) => {
  if (w !== "0" && w !== "1") throw new Error(`decodeReg: ${w}, ${reg}`);

  if (w === "0")
    return {
      "000": "al",
      "001": "cl",
      "010": "dl",
      "011": "bl",
      "100": "ah",
      "101": "ch",
      "110": "dh",
      "111": "bh",
    }[reg];

  return {
    "000": "ax",
    "001": "cx",
    "010": "dx",
    "011": "bx",
    "100": "sp",
    "101": "bp",
    "110": "si",
    "111": "di",
  }[reg];
};

const decodeRm = (w: string, mod: Mod, rm: string) => {
  if (mod !== "RegMode" || (w !== "0" && w !== "1"))
    throw new Error(`rm decoding failed: ${w}, ${mod}`);

  if (w === "0")
    return {
      "000": "al",
      "001": "cl",
      "010": "dl",
      "011": "bl",
      "100": "ah",
      "101": "ch",
      "110": "dh",
      "111": "bh",
    }[rm];

  return {
    "000": "ax",
    "001": "cx",
    "010": "dx",
    "011": "bx",
    "100": "sp",
    "101": "bp",
    "110": "si",
    "111": "di",
  }[rm];
};

console.log("bits 16");

type InstrEncoding =
  | "regToFromReg"
  | "immediateToRegMemory"
  | "immediateToReg"
  | "memToAcc"
  | "accToMem"
  | "regToSegment"
  | "segmentToReg";

const mnemoInstructionMap: Record<string, InstrEncoding> = {
  "100010": "regToFromReg",
  "1100011": "immediateToRegMemory",
  "1011": "immediateToReg",
  "1010000": "memToAcc",
  "1010001": "accToMem",
  "10001110": "regToSegment",
  "10001100": "segmentToReg",
};

const padAndParse = (byte: number) => byte.toString(2).padStart(8, "0");

const classifyInstr = (byte: number): InstrEncoding => {
  const binaryStr = padAndParse(byte);

  const matches = Object.entries(mnemoInstructionMap).filter(
    ([k, v]) => binaryStr.substr(0, k.length) === k
  );

  if (matches.length === 0) throw Error("no match");

  if (matches.length > 1) throw Error("too many matches");

  return matches[0][1];
};

type Mod = "MemModDis0" | "MemModeDis8" | "MemModeDis16" | "RegMode";

const modMap: Record<string, Mod> = {
  "00": "MemModDis0",
  "01": "MemModeDis8",
  "10": "MemModeDis16",
  "11": "RegMode",
};

const classifyMod = (byte: number): Mod => {
  const binaryStr = padAndParse(byte).substring(0, 2);
  const match = modMap[binaryStr];

  if (!match) {
    throw Error("no mod found");
  }

  return match;
};

const Bit = z.union([z.literal("0"), z.literal("1")]);
const TwoBit = z.union([
  z.literal("00"),
  z.literal("01"),
  z.literal("10"),
  z.literal("11"),
]);
const ThreeBit = z.union([
  z.literal("000"),
  z.literal("001"),
  z.literal("010"),
  z.literal("011"),
  z.literal("100"),
  z.literal("101"),
  z.literal("110"),
  z.literal("111"),
]);

const readBitFromByte = (byte: number, bitNo: number): z.infer<typeof Bit> =>
  Bit.parse(padAndParse(byte).substring(bitNo, bitNo + 1));

const byteAt = (ar: Uint8Array, ind: number): number => {
  const retval = ar.at(ind);
  if (retval == undefined) throw new Error(`No value at ${ind}`);

  return retval;
};

const main = (byteOffset: number): void => {
  if (byteOffset >= bytes.length) return;

  const byte = byteAt(bytes, byteOffset);
  const bytePlus1 = byteAt(bytes, byteOffset + 1);

  const instr = classifyInstr(byte);

  switch (instr) {
    // deno-lint-ignore no-fallthrough
    case "regToFromReg": {
      const mod = classifyMod(bytePlus1);
      const reg = padAndParse(bytePlus1).substring(2, 5);
      const rm = ThreeBit.parse(padAndParse(bytePlus1).substring(5, 8));

      const w = readBitFromByte(byte, 7);
      const dir = readBitFromByte(byte, 6);

      const regDec = decodeReg(w, reg);

      // need to look at mod field to know next steps
      switch (mod) {
        // move in between registers, we only need byte and nextByte
        case "RegMode": {
          // TODO DIR
          const rmDec = decodeRm(w, mod, rm);
          const retval =
            dir === "1" ? `mov ${regDec}, ${rmDec}` : `mov ${rmDec}, ${regDec}`;

          console.log(retval);

          return main(byteOffset + 2);
        }

        case "MemModDis0":
        case "MemModeDis8":
        case "MemModeDis16": {
          // memory mode - rm dictates how the effective address is calculated

          let sndOperand: string;

          switch (rm) {
            case "000":
              sndOperand = "[bx + si";
              break;

            case "001":
              sndOperand = "[bx + di";
              break;

            case "010":
              sndOperand = "[bp + si";
              break;

            case "011":
              sndOperand = "[bp + di";
              break;

            case "100":
              sndOperand = "[si";
              break;

            case "101":
              sndOperand = "[di";
              break;

            case "110": {
              sndOperand = "[bp";
              break;
            }

            case "111":
              sndOperand = "[bx";
              break;

            default: {
              const exhaustiveCheck: never = rm;
              throw new Error(`Unhandled color case: ${exhaustiveCheck}`);
            }
          }

          // mod = 00
          if (mod === "MemModDis0") {
            sndOperand =
              rm === "110"
                ? `[${parseInt(padAndParse(bytePlus1), 2)}]`
                : sndOperand + "]";

            console.log(
              dir === "1"
                ? `mov ${regDec}, ${sndOperand}`
                : `mov ${sndOperand}, ${regDec}`
            );

            return main(byteOffset + 2);
          }

          // mod = 01
          if (mod === "MemModeDis8") {
            sndOperand += `+ ${parseInt(
              padAndParse(byteAt(bytes, byteOffset + 2)),
              2
            )}]`;

            console.log(
              dir === "1"
                ? `mov ${regDec}, ${sndOperand}`
                : `mov ${sndOperand}, ${regDec}`
            );

            return main(byteOffset + 3);
          }

          sndOperand += `+ ${parseInt(
            padAndParse(byteAt(bytes, byteOffset + 3)).concat(
              padAndParse(byteAt(bytes, byteOffset + 2))
            ),
            2
          )}]`;

          console.log(
            dir === "1"
              ? `mov ${regDec}, ${sndOperand}`
              : `mov ${sndOperand}, ${regDec}`
          );

          return main(byteOffset + 4);
        }

        // mod = 01

        default:
          throw Error(`unhandled instruction, mod: ${instr}, ${mod}`);
      }
    }

    case "immediateToReg": {
      const w = readBitFromByte(byte, 4);
      const reg = padAndParse(byte).substring(5, 8);
      const bytePlus2 = byteAt(bytes, byteOffset + 2);

      const data =
        w === "0"
          ? bytePlus1
          : parseInt(padAndParse(bytePlus2).concat(padAndParse(bytePlus1)), 2);

      const offset = w === "0" ? 2 : 3;

      console.log(`mov ${decodeReg(w, reg)}, ${data}`);

      return main(byteOffset + offset);
    }
    default:
      throw Error(`unhandled instruction: ${instr}`);
  }
};

main(0);
