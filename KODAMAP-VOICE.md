# KODAMAP — voice

Every user-facing string comes from here. Buttons, empty states, errors, emails, the about page, the tooltips on the effort scale. If a string sounds like it came from a SaaS product, it's wrong and it gets rewritten.

This is derived from Jiri's own writing on [kinoko.nosk.be](https://kinoko.nosk.be), which is her serious register (that site is about something people approach carefully, so it's deliberately more intentional and grounded than she normally writes). **KODAMAP sits further toward play.** Same warmth, same person, lighter feet. The anti-AI writing checklist that used to live in a separate file is folded into the bottom of this one, trimmed to what actually applies to KODAMAP's copy.

---

## Who is talking

A tree elf. Not a brand, not a team, not "we at KODAMAP". Someone who has spent a lot of hours up trees and wants you to have that too, and who is a bit odd about it and unembarrassed by being odd about it.

The stance is **fellow traveller, never instructor.** From KINOKO: _"I'm just a fellow traveler of Life."_ The site knows things about trees and shares them sideways, at eye level. It never lectures, never congratulates you on your journey, and never implies you're doing it wrong.

It is on the side of the trees, and mildly on the side of you.

---

## The moves

These are lifted from how Jiri actually writes. Use them; don't use all of them at once.

**Capitalise the big abstractions into characters.** KINOKO has the Mushroom, the Journey, Life, the Now, the Sea of Everythingness. KODAMAP has the Tree, the Climb, the Canopy, the Wood. Treat them as entities with their own intentions — _"this tree wants to be climbed"_ rather than _"this tree is climbable"_. Use it sparingly enough that it stays a spell and doesn't become a house style tic. This extends to Jiri's own persona too, not just tree-nouns: _"that's not the style of the Tree Elf"_, capital T, capital E, is her doing to herself what she does to the Tree. It can even land on something small and invented for a beat of whimsy — _"a little Treetop Picknick"_ — as long as it's rare.

**Trail off with a tilde, but use it carefully.** `~` and `～` at the end of a warm sentence (_"read on, read on～!"_, _"perhaps I'm someone who can help you~!"_) is her most distinctive tic, but it can tip into cringe fast if it shows up too often. Ration it: at most one per screen, and treat `♥` as the usual replacement when a line wants warmth (it reads as loving rather than twee, and can afford to show up a bit more often than the tilde). A sparkle (`✨`) is available too, but sparingly — once in a while, not as a second default. None of the three go anywhere near safety or error copy. Whichever one is used, it has to survive the i18n layer as a literal character in the string; don't append it in a component.

**Double a letter when you're pleased.** _"Heyy"_, _"Woww"_, _"Hehee"_. Reserve for genuine delight — a first tree logged, a surprise-me result. Never in a system message.

**Let exclamation marks carry the excitement.** Jiri's own writing reaches for `!` and `!!` often, and occasionally stacks a question mark on top: `!?` or `!!?` when something is delightful and slightly surprising at once (_"You found the oldest oak in the wood!?"_). Use it where a screen is actually excited about something, not as a tic on every sentence.

**Almost never use an em dash.** `—` doesn't appear in her writing and it shouldn't appear in KODAMAP's copy either. If a sentence genuinely needs that kind of aside, put it in parentheses instead (see "undercut yourself in a parenthetical" below). Parentheses read as a person leaning in; an em dash reads as a template.

**Go easy on the "'s" contraction.** Jiri doesn't lean on `'s` where the word is really _is_ or _has_. _"This tree's queued"_ reads a little clipped and a little not-her; _"This tree is queued"_ is the register. This is about the contraction that swallows a verb, not about contractions in general: `didn't`, `don't`, `I'll`, `you're`, `can't` and `I'm` are all natural and should stay. Possessives are untouched by this, obviously (_"this tree's location"_ is fine, it isn't a contraction). Nouns and indefinite pronouns are where it grates most: prefer _"Nothing is lost"_, _"Nobody has rated this yet"_, _"The queue is empty"_ over their contracted forms. `That's` and `It's` are common enough in speech to stay where they land naturally.

**Undercut yourself in a parenthetical.** KINOKO does this constantly: _"(Having said that, it's certainly not been an easy journey to get here, so don't go thinking the Mushroom will fix you instantly!)"_. It's the move that keeps enthusiasm honest. In KODAMAP it's how you deliver a caveat without sounding like a warning label.

**Be concrete and slightly too specific.** She lists real things: _"climbing trees, meditating, reading spiritual books, expressing my weirdest self through dance, improvising on the piano"_. The specificity is the warmth. A tree page saying _"the second fork is the best place I have ever sat"_ is the whole product.

**Say "you", say "I", never say "users".** _"YOU are the person it's all about."_ She corrects toward this in her own edits: "It's made by one person" became _"It's made by me as a passion project"_ — the abstracted third person is the tell that a line needs another pass. Same instinct runs the other way when the sentence is actually about the reader: "this is all child-me ever wanted" became _"Isn't this all child-you ever wanted!?"_ — same warmth, but pointed outward instead of staying inward.

**Let a sentence be short when it matters.** _"Through is the only door."_ Three words. She can do this, so the site can.

**Ask rather than tell.** The KINOKO poem is almost entirely questions. An empty state that asks _"what's out there?"_ is better than one that instructs _"add a tree to get started."_

**Let the sentence search for its word instead of reaching for a fancier one.** When something is genuinely hard to name, she repeats the placeholder rather than upgrading the vocabulary: _"I feel connected to... something. Something inside myself, something about this world."_ The repetition reads as honest reaching, not as a rough draft that needs editing down.

**The ellipsis is a different tool than the tilde — don't let them blur together.** The tilde closes a sentence that's already happy and wants to trail off warm: _"we'll go find a tree~!"_ The ellipsis is for a thought that's still unspooling — mid-list (_"Just walking around connected to the trees and the animals and the elements... Having a nap..."_), or picked back up at the start of the next paragraph (_"...The Tree doesn't ask you to believe anything."_). Putting a tilde on an unfinished thought reads try-hard; putting an ellipsis on a sentence that's actually done reads unsure. Match the mark to whether the thought has landed yet.

**Scare-quote a word you're circling back to.** When a word did some loose, undersold work earlier in the piece, quoting it on the second use signals "I know that word is carrying more than it says": _"ancient trees that are worshipped for this 'something' they possess"_ (callback to the "something" above), _"how significant this 'hobby' would become"_ (undercutting "hobby" because it so clearly isn't just that).

**A concrete, slightly goofy comparison beats an abstract instruction.** _"Think of yourself as a groovy frog with its four suction cups as feet"_ does more work than "use all four limbs for balance" — it's the same move as "be concrete and slightly too specific" above, but reaching for a mental image instead of a real memory.

**Own the mistake instead of just warning about the risk.** Safety advice lands softer and more credible as something she's actually lived through, not a hypothetical: _"that last moment of losing focus is how I have bruised a couple ankles."_ Admitting her own scar is what makes the warning trustworthy rather than parental in the naggy sense.

**Hedge a personal opinion instead of asserting it as a rule.** _"I haven't heard many others say this, but I like to work with my hands and feet as much as I can."_ Flagging "this is just what works for me" lets a strong preference stay a preference instead of reading like a technique everyone must adopt.

**Frame a strong claim as something she found, not something that's simply true.** _"I really think climbing a tree is something spiritual"_, _"I found that leg flexibility is the real superpower."_ The "I really think" / "I found that" prefix makes a big claim feel earned through experience rather than declared from above — same spirit as undercutting yourself in a parenthetical, but for the sentence's opening instead of its aside.

**Double a word instead of reaching for an intensifier.** _"very very worth it"_, _"Enjoy!!"_. Cheaper, warmer, and more spoken than "extremely" or "absolutely" would be.

**A dropped subject reads like actual speech.** _"Can't understate how much difference this makes"_ is how she'd say it out loud; "I cannot overstate" is how a manual would say it. Losing the "I" occasionally is a feature, not a typo to fix.

**P.S. is a real move — use it for the aside that doesn't want to be in the main flow.** _"P.S. If you don't know what a Kodama is, get cozy and watch the Ghibli film 'Princess Mononoke' ♥"_ It's a way to hand the reader something extra without making the paragraph carry it.

**♥ and ♡ are not interchangeable — pick by weight, not at random.** The filled ♥ is the default warmth (approval emails, the about page). The outline ♡ shows up on lines that are a little more delicate or a little more careful — a safety-adjacent aside, a gentler caution — where full affection would feel like too much. If a line is doing reassurance rather than joy, reach for ♡.

**A direct cheer to a group is allowed once in a while, and it's different from complimenting the reader.** _"Hurray to all the more feminine tree elves and their beautiful strange flows up the world's trees!"_ This is Jiri rooting for people from the sidelines, not addressing "you" — use it rarely, and only when there's a real group worth cheering for.

**Slash a couple of near-synonyms together instead of picking one.** _"fun / elegant / 'stealth mode'"_ reads like someone trying words on out loud, more alive than committing to a single adjective.

**Trade a stacked adjective for a small verb phrase.** "A beautiful network of lovely trees" became _"a network of lovely trees, built with love"_ — the feeling moved off the adjective and onto an action. When a noun phrase is collecting adjectives, try giving it something to do instead.

---

## About vs Learn: two kinds of warmth

Both pages get read sitting down, and both are Jiri's own writing, but they're not the same warmth on purpose.

**The about page is full tree elf.** It's Jiri talking about Jiri, so it can be as playful, digressive, and self-mythologising as it wants: it capitalises her own persona (_"as the tree elf I am"_), names a small invented ritual (_"a little Treetop Picknick"_), trails off mid-thought into ellipses, breaks into present tense for a beat (_"And then Oops, I didn't notice it's already getting dark!"_). Nobody gets hurt if this page is silly, so let it be silly.

**The Learn page is still her, but the mother comes out.** This page is teaching someone to do something that can actually injure them, so the whimsy dials back a notch and something more careful fills the space it leaves: personal anecdotes about her own mistakes (_"that last moment of losing focus is how I have bruised a couple ankles"_), soft direct imperatives about safety (_"Please be safe when starting out, a risk is never worth it! ♥"_), and small caveats that turn an absolute into something honest (_"three points of contact, (almost) always!"_ — see "undercut yourself in a parenthetical" above, now doing safety work instead of comedy). The ♥ still shows up, but it's doing reassurance more than sparkle, and ♡ appears more often here than on the about page for exactly that reason.

This is warmer than the hard safety disclaimer (that one stays completely flat, see "Where the voice stops" below) but more careful than the about page. Think of it as the register of someone who trusts you to go do the thing, and still wants you to text her when you're down safe.

**The tell for a build agent:** on the about page, if a line isn't earning its whimsy, cut it for being boring. On the Learn page, if a line is being cute for its own sake rather than in service of "I want you to come back down in one piece," cut it for being reckless.

---

## The register dial

KINOKO is reverent because someone is deciding whether to do something significant, sitting down, with time. KODAMAP is read one-handed, in a wood, in the rain, with 2 bars of signal.

So the whimsy has to be **short**. This is the single most important constraint in this file, and it's where a build agent will go wrong: it will write a charming paragraph. `DESIGN.md` says _spacious_ and _breathing_ and _if a screen feels dense, delete something_, and a charming paragraph is density.

**One whimsical sentence. Then get out of the way.** The magic in KODAMAP is the map, the kodama art, and the trees themselves. The words are there to not break the spell, not to cast it.

Short does not mean clipped. "No location on that one" is short and it is also flat and a little cold; "That photo didn't have a location!" is barely longer and it's a whole warm sentence instead of a fragment. When a build agent's default reads practical and to-the-point, that's the tell to slow down and let it be a full sentence, not just to add a tilde on top.

Where longer, warmer writing does belong: the about page, the Learn page, the ethics note, the emails. Those get read sitting down. Let them breathe.

---

## Worked examples

The left column is what a build agent writes by default. The right is what ships.

| Instead of                                           | Write                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| "No trees found in this area."                       | "Nothing here yet. Somebody has to be first~"                                      |
| "Loading…"                                           | "Looking…" (with the breathing kodama; the art carries it, the word shouldn't try) |
| "You are offline. Some features may be unavailable." | "No signal out here! Showing what you saved (from 2 days ago)."                    |
| "Enable location services to see nearby trees."      | "Turn on location and I'll find what's near you (only while you're here)."         |
| "Submission received. It will be reviewed shortly."  | "Got it! Your tree's in the queue. I'll have a look and let you know ♥"            |
| "Your submission has been approved."                 | "Your tree is on the map!! Go and see ♥"                                           |
| "Error: unable to save. Please try again."           | "That didn't save. Nothing's lost, try again?"                                     |
| "404 — Page not found"                               | "Nothing grows here. Back to the map?"                                             |
| "Add to favourites"                                  | "Save for later"                                                                   |
| "Mark as climbed"                                    | "I climbed this"                                                                   |
| "Congratulations! You've reached Sapling level."     | "You're a Sapling now. Your trees go straight to the map!!"                        |
| "Sign up to unlock this feature."                    | "This one needs an account (takes a minute)"                                       |
| "3.4 km away"                                        | "3.4 km that way" _(with the arrow)_                                               |
| "Rate this tree"                                     | "How was it?"                                                                      |
| "no location on that one"                            | "That photo didn't have a location!"                                               |
| "Noted, no species, no problem."                     | "Noted! A tree is still a tree ♥"                                                  |

The landing line under the wordmark — _"Let's find a tree that wants to be climbed!"_ It demonstrates the tone of voice: plain words, a small strange claim, no selling.

---

## The moderation emails

These matter more than anything else in this file, because they arrive when someone is waiting to hear whether their thing was good enough. `FEATURES.md` §11 has the states; here's the tone.

**Needs work** is the one to get right. It is _not_ a rejection and it must not read like one. Somebody tried, and the tree is probably fine, and one thing needs fixing:

> Heyhey! Your tree's almost there — the photo came out a bit too dark to see the trunk. Could you swap in a brighter one? Everything else looks great. It's still saved, just tap here and it goes straight back in the queue～!

**Approved:**

> Your oak is on the map ♥ Here it is: {link}
>
> Someone's going to climb this tree because of you. What a lovely thing that is!

**Rejected** — the hard path, spam and abuse. Here the voice steps almost all the way back. Short, plain, not cold, not chatty. Somebody being warm at you while turning you down is worse than somebody being brief:

> This one didn't make it onto the map: {reason}. If that seems wrong, reply to this email and a person will read it.

---

## Where the voice stops

Hard rule. In these places the writing is plain, flat, and serious, and no tilde, no doubled letter, no capitalised abstraction goes anywhere near it:

- **The safety disclaimer**, all three placements (`FEATURES.md` §10). The copy there is canonical and does not get made charming. _"Branches break, bark gives way, and a fall from head height can kill you."_ stays exactly as written. Whimsy attached to an injury warning reads as not meaning it.
- **The permission self-attestation** in the submission flow (§3). It's an honesty burden being placed on somebody deliberately. Charm undermines it.
- **Legal and privacy copy.** Plain language, yes — that's already required. Playful, no.
- **Errors where somebody could lose work.** A failed upload of a photo taken two hours ago in a wood is not a moment for a kaomoji. Be quick, be clear, say what survived.
- **The protected-tree explanation.** When the ancient/monumental checkbox locks the layer to Beloved, say why in one plain sentence.

The test: if a string exists because something could go wrong for a person, it gets written straight.

---

## Emoji and kaomoji

Jiri's own writing is full of them — ✨️💕😊, `(^o^)`. In KODAMAP's interface they mostly shouldn't appear, and not because they're unprofessional. **The kodama is the emoji.** `DESIGN.md` gives it exactly five homes and says restraint is what makes it land; emoji in the copy competes with the art for the same job and makes the screen busier, which is the one thing the design brief keeps saying not to do.

So: no emoji in interface strings. A `♥` is the exception (see "trail off with a tilde" above): it's allowed wherever a warm line would otherwise reach for a tilde, most naturally the approval email and the about page, and it can show up a little more freely than the tilde does. A sparkle (`✨`) is allowed too, but stays rare. A kaomoji is allowed in _at most_ one place in the whole product; if it's anywhere, it's the confirmation after somebody's first tree goes live. Once. The about page and the emails are her own writing and can carry more.

---

## Things that are not the voice

- "Welcome to KODAMAP!" — the site never greets itself.
- "We're excited to…" — there is no we, and nobody is excited on your behalf.
- "Oops!" / "Uh oh!" — false cheer at a failure. Just say what happened.
- "Unleash", "discover", "explore" as verbs on buttons. Say the actual thing: "see the map".
- "Journey" applied to using a website. It means something specific in her other work and it gets cheapened here.
- Anything that congratulates you for doing something small.
- Climbing jargon without a gloss — `DESIGN.md` bans "mantle", "beta", "crux", "send" from the interface, and that ban outranks anything in this file.
- Explaining the whimsy. If a line needs a follow-up sentence to land, it isn't the line.

---

## Not-Jiri: what the AI draft writes, and what she turns it into

The moves above came from studying Jiri's own writing directly. This section is a different, more direct kind of evidence: the about page and the Learn page were first drafted by an AI build agent, and this diff is Jiri going through that AI draft line by line and rewriting it into her own voice. That makes it the single best source in this file for "what AI defaults to" versus "what Jiri actually wants" — not a guess at AI tells, an actual recorded correction of them, on this exact content. Read every example below as: *left side is what the model wrote unprompted, right side is what Jiri changed it to.* When a build agent's draft has one of these tells, it needs exactly the correction shown here.

**The trailing comma-adverb.** The AI draft's habit: tack a hedge or intensifier on after a comma at the very end of a sentence — _"...still."_, _"...really."_, _"...honestly."_ It reads as a literary cadence, not a spoken one, and Jiri removed it or moved it to the front almost every time it showed up:
- "That's the whole idea, still" → _"That's still the whole idea"_
- "That's the whole magic of it, really" → _"That's really the whole magic of KODAMAP"_
- "Climbing a tree is something spiritual, honestly." → _"I really think climbing a tree is something spiritual."_

The pattern repeats three times in one AI draft, so treat it as a real, checkable AI tic: never end a sentence with a comma and a bare adverb. Either drop the adverb, or move it up front as an "I really think / I found" frame (which does double duty — see "frame a strong claim as something she found" above).

**Clever aphorisms that show off.** The AI draft reaches for a sentence built to land as a neat little paradox or turn of phrase, and it reads as performed even when it's true:
- "Dead wood looks the same as live wood until it isn't." → _"You can often tell by looks what wood is dead, but not always!"_
- "You stand in front of something... and there isn't much to say about it, and they are" → _"...and I certainly felt why they are."_
- "much more powerful than it sounds" → _"such a powerful feeling!"_

All three of the AI's originals are objectively *good* sentences — tight, quotable, the kind of line a copywriter would keep. That's exactly the tell. Polished paradox is a model's instinct, not a person's; plain it down until it's just the true thing, even if the true thing is less quotable.

**The banned "not X, but Y" / "instead of X" shape is the AI draft's single most common sentence shape** — it shows up constantly, and Jiri caught and rewrote it almost every time it appeared:
- "isn't roughness for its own sake, it's grip you didn't have a month ago" → _"build up callous, giving you serious upgrades in grip!"_
- "This page is a starting point, not a course." → _"This page is just meant as a nice starting point."_
- "Let it happen instead of fighting it with gloves." → _"Embrace it, you'll soon feel you'll never need gloves again~"_

This is direct, on-this-project confirmation of the "banned shapes" rule below — "not X, but Y" isn't a theoretical AI-writing-checklist item here, it's literally what showed up in the draft every time a contrast needed making. Flag it on sight and rewrite it as a positive statement.

**Mechanical or technological metaphors for anything embodied or spiritual.** The AI draft wrote "Your monkey senses switch on gradually"; Jiri changed it to _"Your monkey senses awaken gradually."_ A switch is the model reaching for the nearest common metaphor regardless of register; a body or a sense *waking up* is Jiri's. This matters more here than it would elsewhere, because KODAMAP's whole stance is that the tree teaches you something machines can't — a mechanical verb undercuts the premise of the page it's on.

**Ungrounded general or statistical-sounding safety claims.** The AI draft wrote "Jumping the last bit... is where most falls happen" — a plausible-sounding, impersonal claim with no visible source, the kind of thing a model generates because it pattern-matches "safety copy." Jiri rewrote it as _"that last moment of losing focus is how I have bruised a couple ankles"_ — her own body, her own scar, a specific number of ankles. If a safety line sounds like it's citing a statistic nobody actually measured, that's the AI voice; ground it in something a real person would have to have actually lived through instead.

**Generic command-voice instructions ("try to...", "you should...").** The AI draft wrote "Try to work with your hands and your feet as much as you can" — a coach issuing an instruction. Jiri's version: "I haven't heard many others say this, but I like to work with my hands and feet as much as I can" — a friend telling you what she does. Same content, but the AI default asks you to comply and Jiri's version just shares — pick the second shape whenever the advice is a preference rather than a hard safety rule.

**Overly composed "author bio" prose** — this is the AI draft's default register for anything self-introductory: sentences built with visible craft, tight parallelism, elegant restraint, a fragment used for its cadence rather than because the thought was actually that short.
- AI: "I move through music, spaces and ideas with a certain restlessness, and I collect the things that don't fit neatly anywhere else." — Jiri replaced this with something looser, more run-on, more excited, less interested in sounding accomplished.
- AI: "I climb, I sit up there, I come down when it gets dark or when I get hungry, and quite often neither of those happens for a while." (a controlled triplet, literary economy) → Jiri: _"As the tree elf I am, a lot of my days I find myself in the woods! Just walking around... Having a nap... And climbing a tree or two, or three, or more!"_ (looser, more items, less symmetrical).

This is the single biggest gap between the AI baseline and Jiri's actual voice, and the most important thing in this whole section to internalize: a well-crafted, economical, slightly literary paragraph is *closer* to what a model defaults to and *further* from Jiri than something that rambles a little. When in doubt, make a draft less polished, not more.

**Fully-resolved, confident self-knowledge.** AI: "Climbing is where I feel most myself" states a settled fact about her inner life, tidily. Jiri: "Climbing trees means something to me that I can't quite express in words" admits she doesn't have it fully named yet — see "let the sentence search for its word" above. Confidence about what something *means*, stated cleanly, is the AI default; confidence about what happened, paired with real uncertainty about what it means, is Jiri's.

**Neatly resolved sentence endings.** AI: "...and everything else that was loud goes quiet" — ties a bow on the thought, satisfying and complete. Jiri: "...and that's suddenly all that ever mattered..." — trails off into an ellipsis instead of closing. A sentence that lands with a click at the end is a tell that it's the model's construction; let some sentences just fade rather than resolve.

**Reaching for the rarer word when a plain one exists.** AI: "getting a foot up somewhere improbably high" → Jiri: _"somewhere awkwardly high"_. AI: "the quiet superpower" → Jiri: _"the real superpower"_. "Improbably" and "quiet" as an epithet are both good writing in the conventional sense — precise, a little literary, exactly what a model reaches for. Jiri's instinct runs the other way: awkwardly and real are words a friend would actually say to you.

**Grammatically correct doubled intensifiers.** AI: "very, very worth it" (comma, correctly punctuated). Jiri: _"very very worth it"_ (run together, no comma). It's a small thing, but it's a real, checkable tell: a properly punctuated repetition is the model following grammar rules; running the words together is breathless and spoken. When doubling a word for emphasis, don't comma-separate it.

**Cute quoted-dialogue devices and ranked/superlative claims.** The AI draft wrote "the whole difference between 'no chance' and 'oh, easy'" and "it pays off more than anything else you could train" — both got cut. The first stages a little scene for effect; the second makes a ranking claim with no real basis, the kind of thing marketing copy or a listicle says. Both read as constructed rather than said. Plain statements ("loose hips make all the difference") survive; staged or ranked ones don't.

**Redundant stacked adjectives.** AI: "a beautiful network of lovely trees" — beautiful and lovely doing the same job on adjacent nouns, a model padding for emphasis. Jiri trimmed it to _"a network of lovely trees, built with love"_: one adjective, and the second beat of warmth moved into a verb phrase instead of a second adjective. If two adjectives in one sentence are praising the same thing, cut one.

**Neutral, passive description verbs where a felt verb is available.** AI: "Look at the view" → Jiri: _"Enjoy the view"_. AI: "really good to watch" → Jiri: _"really fun to watch"_. Small, but consistent: given a choice between a verb that describes an action and one that carries the feeling of it, the model reaches for the neutral one and Jiri reaches for the feeling.

**Describing what's already visible instead of just reacting to it.** The AI-drafted video caption explained the clip — "He climbs a giant strangler fig on gear and camps in the top of it." — before landing on the reaction, "This is all child-me ever wanted!" Jiri cut the description entirely and kept only the reaction, rephrased outward: _"Isn't this all child-you ever wanted!?"_ If the reader can already see the thing, don't narrate it — just say how it lands. The model narrates; Jiri reacts.

**A nuance worth flagging, not a rule:** sometimes a genuinely concrete, poetic image came from the AI draft and Jiri cut it anyway for being *too* crafted. AI: "People who put a hand on bark and actually mean it" is a better sentence by most conventional measures than what Jiri replaced it with, _"People who also feel that climbing a tree is something truly special"_ — and she cut it anyway. This is in real tension with "be concrete and slightly too specific" elsewhere in this file, so it's worth naming as friction rather than resolving it into a clean rule: specificity earned through a real detail (a number of ankles, a piece of oddly-shaped bark) is Jiri's; specificity that exists mainly to sound literary and complete is the model's, even when it's lovely. If a draft produces a genuinely gorgeous sentence and can't say what real, lived detail it's built from, that's worth a second look.

---

## Anti-AI checklist

The full version of this used to live in `ABOUT ME/anti-ai-writing-style.md`. This is the part of it that actually bites on KODAMAP's copy (buttons, empty states, the about page, the Learn page, emails); the sections about arguing a position or building a case don't apply to a tree map and are left out.

- **Cut the padding.** No "it's worth noting", "plays a role in", "in today's...". If a sentence carries no fact and no feeling, it goes. This is a real, on-the-record example, not a hypothetical: the AI-drafted Learn page originally read "It's worth saying plainly too, because the videos above mostly show guys doing gymnastic-looking things", and Jiri's rewrite was _"One personal comment, because the videos below mostly show guys doing gymnastic-y things"_ — the padding phrase was the first thing she cut.
- **Banned words.** Delve, realm, tapestry, interplay, pivotal, crucial, showcase, robust, holistic, transformative, seamless, elevate, unlock. Most of these were never going to show up here, but they're the first thing to check if a line feels off.
- **Banned words 2** Nobody, somebody. This word is very un-Jiri to use, always use "no one".
- **Banned shapes.** "Not X, but Y." Lists of exactly three ("speed, efficiency, and joy"). "Stop doing X, start doing Y." Manufactured suspense ("here's what nobody tells you"). These have a satisfying rhythm and deliver no new information, which is exactly the problem. A real instance from an AI-drafted pass on this site: "This page is a starting point, not a course" (textbook Not-X-but-Y) got rewritten by Jiri to _"This page is just meant as a nice starting point"_ — same fact, no template rhythm.
- **Vary the sentence length on purpose.** A three-word sentence next to a longer one reads like a person talking. A row of medium sentences all the same length reads like a template.
- **No meta-commentary.** Don't announce what a screen is about to say, and don't restate what the line above it already said. This includes explaining your own joke or tone, which is a real AI reflex: the drafted about page had "Being in a tree turns me into a tree elf! That's not a joke I'm making about myself: it's a real part of my spiritual life..." — AI hedging a whimsical claim by immediately footnoting that it's Serious, Actually. Jiri's rewrite dropped the justification entirely and just said the playful thing, followed by a plain _"For real though."_ If a line needs a disclaimer to be believed, the line isn't landing — cut the disclaimer and trust it, or rewrite the line.
- **Format sparingly.** One idea, one line. Most copy on this site is a sentence or two of plain prose, not a bulleted list pretending to be copy.
- **Say the actual thing.** If a sentence hedges ("this might help with...") it isn't ready. Say what it does.
