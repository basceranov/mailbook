export function toRoman(num) {
  if (!Number.isFinite(num) || num <= 0) return "";
  const pairs = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
  ];
  let out = "";
  for (const [value, numeral] of pairs) {
    while (num >= value) {
      out += numeral;
      num -= value;
    }
  }
  return out;
}
