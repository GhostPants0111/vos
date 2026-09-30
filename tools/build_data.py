"""Build data/verbs.json from Fred Jehle's conjugated verb database.

Source: https://github.com/ghidinelli/fred-jehle-spanish-verbs
License: CC BY-NC-SA 3.0. Vos forms and the -se imperfect subjunctive are derived here.

Run from this folder:  python3 build_data.py
"""
import csv, json, unicodedata
from pathlib import Path

HERE = Path(__file__).parent
ROWS = list(csv.DictReader(open(HERE / 'jehle.csv', encoding='utf-8')))

TENSES = {
    ('Indicativo', 'Presente'):             ('ind_pres',  'Presente',             'Present'),
    ('Indicativo', 'Pretérito'):            ('ind_pret',  'Pretérito',            'Preterite'),
    ('Indicativo', 'Imperfecto'):           ('ind_imp',   'Imperfecto',           'Imperfect'),
    ('Indicativo', 'Futuro'):               ('ind_fut',   'Futuro',               'Future'),
    ('Indicativo', 'Condicional'):          ('ind_cond',  'Condicional',          'Conditional'),
    ('Indicativo', 'Pretérito perfecto'):   ('ind_pp',    'Pretérito perfecto',   'Present perfect'),
    ('Indicativo', 'Pluscuamperfecto'):     ('ind_plus',  'Pluscuamperfecto',     'Past perfect'),
    ('Indicativo', 'Futuro perfecto'):      ('ind_futp',  'Futuro perfecto',      'Future perfect'),
    ('Indicativo', 'Condicional perfecto'): ('ind_condp', 'Condicional perfecto', 'Conditional perfect'),
    ('Indicativo', 'Pretérito anterior'):   ('ind_ant',   'Pretérito anterior',   'Preterite perfect'),
    ('Subjuntivo', 'Presente'):             ('sub_pres',  'Presente',             'Present'),
    ('Subjuntivo', 'Imperfecto'):           ('sub_imp',   'Imperfecto (-ra)',     'Imperfect'),
    ('Subjuntivo', 'Futuro'):               ('sub_fut',   'Futuro',               'Future'),
    ('Subjuntivo', 'Pretérito perfecto'):   ('sub_pp',    'Pretérito perfecto',   'Present perfect'),
    ('Subjuntivo', 'Pluscuamperfecto'):     ('sub_plus',  'Pluscuamperfecto',     'Past perfect'),
    ('Subjuntivo', 'Futuro perfecto'):      ('sub_futp',  'Futuro perfecto',      'Future perfect'),
    ('Imperativo Afirmativo', 'Presente'):  ('imp_aff',   'Afirmativo',           'Affirmative'),
    ('Imperativo Negativo', 'Presente'):    ('imp_neg',   'Negativo',             'Negative'),
}
EXTRA = {'sub_imp_se': ('Imperfecto (-se)', 'Imperfect')}

ACC = {'a': 'á', 'e': 'é', 'i': 'í', 'o': 'ó', 'u': 'ú'}


def strip_acc(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn')


def split_reflexive(inf):
    if inf.endswith('se') and len(inf) >= 4 and strip_acc(inf[-4:-2]) in ('ar', 'er', 'ir'):
        return inf[:-2], True
    return inf, False


VOS_PRES_IRREG = {'ser': 'sos', 'ir': 'vas', 'haber': 'has'}
VOS_IMP_IRREG = {'ir': 'andá', 'ser': 'sé'}


def vos_present(inf):
    base, refl = split_reflexive(inf)
    if base in VOS_PRES_IRREG:
        form = VOS_PRES_IRREG[base]
    else:
        stem, ending = base[:-2], strip_acc(base[-2:])
        form = stem + ('ís' if ending == 'ir' else ACC[ending[0]] + 's')
    return ('te ' + form) if refl else form


def vos_imperative(inf):
    """hablá / comé / viví. With -te the accent drops: lavate, movete, andate."""
    base, refl = split_reflexive(inf)
    if base in VOS_IMP_IRREG:
        f = VOS_IMP_IRREG[base]
        return strip_acc(f) + 'te' if refl else f
    stem, ending = base[:-2], strip_acc(base[-2:])
    v = ending[0]
    return stem + v + 'te' if refl else stem + ACC[v]


def vos_subjunctive(nos_form):
    """From the nosotros subjunctive, which never diphthongises like vos:
    podamos -> podás, contemos -> contés, nos llamemos -> te llamés."""
    if not nos_form:
        return None
    pron = ''
    if ' ' in nos_form:
        nos_form = nos_form.split()[-1]
        pron = 'te '
    if not nos_form.endswith('mos'):
        return None
    head = nos_form[:-3]
    if not head or head[-1] not in ACC:
        return None
    return pron + head[:-1] + ACC[head[-1]] + 's'


def ra_to_se(form):
    for a, b in (('ramos', 'semos'), ('rais', 'seis'), ('ras', 'ses'), ('ran', 'sen'), ('ra', 'se')):
        if form.endswith(a):
            return form[:-len(a)] + b
    return form


verbs = {}
for r in ROWS:
    key = TENSES.get((r['mood'], r['tense']))
    if not key:
        continue
    inf = r['infinitive']
    v = verbs.setdefault(inf, {'en': r['infinitive_english'], 'ger': r['gerund'],
                               'pp': r['pastparticiple'], 't': {}, 'g': {}})
    v['t'][key[0]] = [r['form_1s'], r['form_2s'], r['form_3s'],
                      r['form_1p'], r['form_2p'], r['form_3p']]
    v['g'][key[0]] = r['verb_english']

for inf, v in verbs.items():
    t = v['t']
    if 'sub_imp' in t:
        t['sub_imp_se'] = [ra_to_se(f) if f else f for f in t['sub_imp']]
        v['g']['sub_imp_se'] = v['g'].get('sub_imp', '')
    v['vos'] = {
        'ind_pres': vos_present(inf),
        'imp_aff': vos_imperative(inf),
        'sub_pres': vos_subjunctive(t['sub_pres'][3]) if 'sub_pres' in t else None,
    }

# Monosyllables take no written accent: das, da, des, ves, ve.
MONO = {'dar': {'ind_pres': 'das', 'imp_aff': 'da', 'sub_pres': 'des'},
        'ver': {'ind_pres': 'ves', 'imp_aff': 've', 'sub_pres': 'veás'}}
for k, fix in MONO.items():
    verbs[k]['vos'].update(fix)

# haber is missing from the source database; add it by hand.
def row(stem_list, suffix=''):
    return [f + suffix for f in stem_list]
HE = ['he', 'has', 'ha', 'hemos', 'habéis', 'han']
HABIA = ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían']
HABRE = ['habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán']
HABRIA = ['habría', 'habrías', 'habría', 'habríamos', 'habríais', 'habrían']
HUBE = ['hube', 'hubiste', 'hubo', 'hubimos', 'hubisteis', 'hubieron']
HAYA = ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan']
HUBIERA = ['hubiera', 'hubieras', 'hubiera', 'hubiéramos', 'hubierais', 'hubieran']
HUBIERE = ['hubiere', 'hubieres', 'hubiere', 'hubiéremos', 'hubiereis', 'hubieren']
if 'haber' not in verbs:
    t = {'ind_pres': HE, 'ind_pret': HUBE, 'ind_imp': HABIA, 'ind_fut': HABRE, 'ind_cond': HABRIA,
         'ind_pp': row(HE, ' habido'), 'ind_plus': row(HABIA, ' habido'), 'ind_futp': row(HABRE, ' habido'),
         'ind_condp': row(HABRIA, ' habido'), 'ind_ant': row(HUBE, ' habido'),
         'sub_pres': HAYA, 'sub_imp': HUBIERA, 'sub_fut': HUBIERE,
         'sub_pp': row(HAYA, ' habido'), 'sub_plus': row(HUBIERA, ' habido'), 'sub_futp': row(HUBIERE, ' habido')}
    t['sub_imp_se'] = [ra_to_se(f) for f in HUBIERA]
    verbs['haber'] = {'en': 'to have (auxiliary: he comido); impersonal hay = there is, there are',
                      'ger': 'habiendo', 'pp': 'habido', 't': t, 'g': {},
                      'vos': {'ind_pres': 'has', 'imp_aff': None, 'sub_pres': 'hayás'}}

tenses = {k[0]: [k[1], k[2]] for k in TENSES.values()}
tenses.update({k: list(v) for k, v in EXTRA.items()})
out = HERE.parent / 'data' / 'verbs.json'
json.dump({'tenses': tenses, 'verbs': verbs}, open(out, 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))
print(f'{len(verbs)} verbs -> {out} ({out.stat().st_size // 1024} KB)')
