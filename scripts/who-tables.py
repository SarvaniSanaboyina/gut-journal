import sys
d = sys.argv[1]
out = []
def load(name):
    rows = {1: {}, 2: {}}
    with open(f'{d}/{name}') as f:
        next(f)
        for line in f:
            p = line.rstrip('\n').split('\t')
            rows[int(p[0])][int(p[1])] = (float(p[2]), float(p[3]), float(p[4]))
    return rows
ages = sorted(set(list(range(0, 1827, 7)) + [730, 731, 1826]))
out.append("// Generated from the WHO Child Growth Standards (0–5 years) LMS tables published in the WHO")
out.append("// `anthro` package (github.com/WorldHealthOrganization/anthro, data-raw/growthstandards).")
out.append("// Sampled every 7 days (plus days 730/731 where length switches to height); intermediate days")
out.append("// are linearly interpolated, which differs from the daily tables by far less than measurement error.")
out.append("// Each row: [age in days, L, M, S]. Do not edit by hand.")
out.append("")
out.append("export type LmsRow = readonly [number, number, number, number]")
out.append("type Table = { male: readonly LmsRow[]; female: readonly LmsRow[] }")
out.append("")
for name, key in [('weianthro.txt', 'WEIGHT_FOR_AGE'), ('lenanthro.txt', 'LENGTH_FOR_AGE'), ('bmianthro.txt', 'BMI_FOR_AGE')]:
    t = load(name)
    out.append(f"export const {key}: Table = {{")
    for sex, label in [(1, 'male'), (2, 'female')]:
        rows = ','.join(f"[{a},{t[sex][a][0]:g},{t[sex][a][1]:g},{t[sex][a][2]:g}]" for a in ages)
        out.append(f"  {label}: [{rows}],")
    out.append("}")
    out.append("")
print('\n'.join(out))
