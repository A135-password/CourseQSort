"""
55-bit bitmap for weekly schedule (5 days × 11 periods).
Bits indexed as: (day_of_week - 1) * 11 + (period - 1)
"""


def build_bitmap(time_slots):
    bits = ["0"] * 55
    for day, period in time_slots:
        idx = (day - 1) * 11 + (period - 1)
        if 0 <= idx < 55:
            bits[idx] = "1"
    bit_str = "".join(bits)
    # hex with leading zeros to ensure 14 hex chars (55 bits = 14 hex chars)
    hex_val = format(int(bit_str, 2), "014X")
    return "0x" + hex_val


def parse_bitmap(bitmap_str):
    hex_part = bitmap_str.replace("0x", "").replace("0X", "")
    bit_str = bin(int(hex_part, 16))[2:].zfill(55)
    slots = []
    for i in range(55):
        if bit_str[i] == "1":
            day = i // 11 + 1
            period = i % 11 + 1
            slots.append((day, period))
    return slots


def bitmap_and(a, b):
    a_val = int(a.replace("0x", ""), 16) if isinstance(a, str) else a
    b_val = int(b.replace("0x", ""), 16) if isinstance(b, str) else b
    return a_val & b_val


def has_conflict(bitmap_a, bitmap_b):
    return bitmap_and(bitmap_a, bitmap_b) != 0
