# 04. UI glossary (Spanish game labels to save values)

The sample game is in **Spanish**. The save stores language-independent values; the game renders the labels. This glossary maps what was seen on screen to the parser's keys and to the values in 03. Rows marked *seen* were observed in screenshots; *unconfirmed* means the expansion was not shown by the game.

## 1. Attributes (Spanish label to parser key)

Verified for outfield players (36 of 36, Gartenmann) and goalkeepers (35 of 35, Mair).

| Group | Spanish label | Parser key |
|---|---|---|
| Técnico | Cabeceo | `heading` |
| | Centros | `crossing` |
| | Control | `firstTouch` |
| | Entradas | `tackling` |
| | Marcaje | `marking` |
| | Pases | `passing` |
| | Penalti | `penaltyTaking` |
| | Regate | `dribbling` |
| | Remate | `finishing` |
| | Saques de esquina | `corners` |
| | Saques largos | `longThrows` |
| | Técnica | `technique` |
| | Tiros lejanos | `longShots` |
| | Tiros libres | `freeKickTaking` |
| Mental | Agresividad | `aggression` |
| | Anticipación | `anticipation` |
| | Colocación | `positioning` |
| | Concentración | `concentration` |
| | Decisiones | `decisions` |
| | Desmarques | `offTheBall` |
| | Determinación | `determination` |
| | Juego en equipo | `teamwork` |
| | Liderazgo | `leadership` |
| | Sacrificio | `workRate` |
| | Serenidad | `composure` |
| | Talento | `flair` |
| | Valentía | `bravery` |
| | Visión | `vision` |
| Físico | Aceleración | `acceleration` |
| | Agilidad | `agility` |
| | Alcance de salto | `jumpingReach` |
| | Equilibrio | `balance` |
| | Fuerza | `strength` |
| | Recuperación física | `naturalFitness` |
| | Resistencia | `stamina` |
| | Velocidad | `pace` |
| Portería | Alcance aéreo | `aerialReach` |
| | Blocaje | `handling` |
| | Comunicación | `communication` |
| | Excentricidad | `eccentricity` |
| | Golpeo de puños (tendencia) | `punching` |
| | Mando en el área | `commandOfArea` |
| | Reflejos | `reflexes` |
| | Salidas (tendencia) | `rushingOut` |
| | Saque con la mano | `throwing` |
| | Saques de puerta | `kicking` |
| | Uno contra uno | `oneOnOnes` |
| Pies | Pierna izquierda / derecha | `leftFoot` / `rightFoot` |

Foot labels (verified on 5 profiles): **20 = Muy fuerte, 10 = Razonable, 7 = Débil**. Other values were not seen (for example "Bastante fuerte" appeared for Cook's left foot; its numeric value was not checked).

## 2. Positions

The save stores **15 familiarity ratings** in this order. The Spanish UI uses these codes (the design's 14 codes are in bold):

| Parser order | Parser code | Spanish UI | Design code | Meaning |
|---|---|---|---|---|
| 0 | GK | POR | **POR** | goalkeeper |
| 1 | SW | (not seen) | | sweeper; has a rating in the save but was never displayed in the screenshots |
| 2 | DL | DF (I) | **DFI** | left back |
| 3 | DC | DF (C) | **DFC** | centre-back |
| 4 | DR | DF (D) | **DFD** | right back |
| 5 | DM | MC | **MC** | defensive midfielder |
| 6 | ML | ME (I) | **MEI** | left midfielder |
| 7 | MC | ME (C) | **MEC** | central midfielder |
| 8 | MR | ME (D) | **MED** | right midfielder |
| 9 | AML | MP (I) | **MPI** | left attacking midfielder |
| 10 | AMC | MP (C) | **MPC** | attacking midfielder |
| 11 | AMR | MP (D) | **MPD** | right attacking midfielder |
| 12 | ST | DL (C) | **DLC** | striker |
| 13 | WBL | CR (I) | **CRI** | left wing-back |
| 14 | WBR | CR (D) | **CRD** | right wing-back |

Reading: `DF` = defensa, `ME` = medio, `MP` = mediapunta, `DL` = delantero, `CR` = carrilero, `MC` = the defensive midfielder; side in brackets (I = izquierda, C = centro, D = derecha). **Be careful with `DL`:** in the parser it means *defender left*; in the Spanish UI it means *delantero* (forward).

**Slot labels** seen in the selection screens (formation slots, with side): `POR`, `DFD`, `DFCD`, `DFCI`, `DFI`, `DFC`, `MC`, `MECD`, `MECI`, `MED`, `MEI`, `MCCD`, `MCCI`, `MPD`, `MPC`, `MPI`, `DLC`, `DLCD`, `DLCI`, `CRD`, `CRI`. A trailing `D` is derecha and `I` izquierda.

## 3. Tactical roles and duties

**Duties (confirmed):** **De** = Defensa, **Ap** = Apoyo, **At** = Ataque, **Ta** = Tapón, **Co** = Cubrir.

**Roles confirmed by an expanded role list** (centre-back): *Defensa central* (`DFC`), *Defensa con toque* (`DCT`), *Líbero*, *Central Práctico*, *Central lateral*. The goalkeeper roles shown were *Portero* and *Portero cierre*. Duties for *Defensa central*: Defensa, Tapón, Cubrir.

**Abbreviations seen on the pitch, expansion not confirmed:** `PCI` (goalkeeper), `CAR` (full-back; may be carrilero or lateral), `PVO`, `MEZ`, `CTT`, `II`, `DLI`, `DLA`, `2ºD`, `CRC`, `MC`. Do **not** assume these expansions; they need the expanded role list of each position.

Roles listed on screen (Muñoz): Extremo (Ap), Organizador adelantado (At), Extremo inverso (Ap), Buscador de espacios (At), Delantero interior (Ap). Papela: "Centrocampista recuperado…" and "Centrocampista todoterreno…" (both names are cut off on screen), Centrocampista (De), Interior mixto (Ap), Mezzala (Ap). The star ratings next to each role are computed by the game.

## 4. Squad status

| Code | Spanish label | English meaning (informal) |
|---|---|---|
| 2 | Jugador importante | important player |
| 3 | Titular habitual | regular starter |
| 4 | Jugador de plantilla | squad player |
| 5 | Revulsivo desde el banquillo | impact substitute |
| 11 | Futura promesa | future prospect |
| 13 | Joven | youngster |
| 21 | Recambio de emergencia | emergency backup |

Codes 0, 1, 7, 10, 20 have no label yet. See 03, section 6.4.

## 5. Contract box and money

- `Contratado por el Aberdeen`, then `$343m p/a hasta el 31/5/2027`, then the squad status label.
- `p/a` = per year (por año). `m` = **mil** (thousand): `$25m p/a` is $25,000 a year. `($197m p/a netos)` = net of tax.
- `4 Primas / 1 Cláusula` = 4 bonuses and 1 clause (not decoded).
- `Se va al Queen's Park el 14/6/2025` = an agreed move (a future record at another club).
- `Finaliza en 1 mes (31/5/2025)` = contract ends in 1 month, shown in red when close.
- The squad lists show wages as `$527.000 p/a` (thousand separator) while the profile shows `$527m p/a`; both mean $527,000.

## 6. Game areas (screens), for reference

`Plantilla` (squad), `Plan de plantilla` (squad planner), `Tácticas` (tactics), `Reservas` (reserve squad), `Sub-18` (under-18 squad), `Vista general / Contrato / Historial` (player profile tabs), `Estadísticas` (statistics), `Información completa` (a squad view). The game's `ID:` in a page header is the **uid** of the player, the **team uid** of a team page (see 03, section 5), or a club-level id (club uid + 1).

## 7. Personality labels

Labels such as `Bastante decidido`, `Equilibrada`, `Profesional` and the player-type description (`Joven cancerbero`, `Veterano central`, `Extremo`, `Centrocampista`) are **computed by the game**. The 8 personality values behind the first kind are in the save; the thresholds are not decoded. Reputation is shown in stars (1 to 5) and was not located.
