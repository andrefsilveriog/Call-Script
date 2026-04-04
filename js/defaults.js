export const CALL_TYPES = [
  { id: "website-lead", name: "Website Lead", icon: "🌐", desc: "Quote sent → call now" },
  { id: "inbound-no-quote", name: "Inbound (No Quote)", icon: "📞", desc: "Asking for quote" },
  { id: "inbound-has-quote", name: "Inbound (Has Quote)", icon: "📋", desc: "Questions about quote" },
  { id: "outbound-post-quote", name: "Follow-Up (Post-Quote)", icon: "📤", desc: "Right after sending" },
  { id: "outbound-no-reply", name: "Follow-Up (No Reply)", icon: "🔄", desc: "No response yet" },
  { id: "voicemail", name: "Voicemail Scripts", icon: "📱", desc: "Leave a message" },
  { id: "gatekeeper", name: "Electronic Secretary", icon: "🤖", desc: "Get through the gate" },
];

export const BRANCH_COLORS = {
  flow: { bg: "#0891b2", text: "#fff" },
  money: { bg: "#d97706", text: "#fff" },
  decision: { bg: "#7c3aed", text: "#fff" },
  danger: { bg: "#dc2626", text: "#fff" },
  back: { bg: "#64748b", text: "#fff" },
  success: { bg: "#059669", text: "#fff" },
};

export const WL_STEPS = [
  {
    id: "s01", num: "01", label: "Open", main: true,
    title: "Opening", subtitle: "Take control immediately and earn permission to lead.",
    script: `"Hi, this is Andre with Joy of Cleaning — how can I help you today?"\n\n→ Listen to their response.\n\n"Absolutely. I'll just ask a few quick questions so I can give you an accurate estimate, okay?"`,
    keyPoints: [
      "Greet with your name and company, then ask how you can help.",
      "Once they ask for a quote, ask permission to lead with qualifying questions.",
      'Wait for their "okay" — that small yes gives you control of the call.',
      "If they push early, seem rushed, or are vague — use branches below.",
    ],
    toneCue: "Warm and confident. Smile when you speak — they can hear it. You set the pace, not them.",
    branches: [
      { targetId: "b01b", label: "Asked for price early", color: "money" },
      { targetId: "b01c", label: "Client sounds rushed", color: "decision" },
      { targetId: "b01d", label: "Not sure what they need", color: "decision" },
    ],
    next: "s02",
  },
  {
    id: "b01b", parentId: "s01", label: "Price Early",
    title: "Price Too Early", subtitle: "Answer briefly, tie price to scope, then regain control.",
    script: `"Great question — it really depends on the size and condition of the home. I'll ask you a couple quick questions so I can give you an accurate number, okay?"`,
    keyPoints: [
      "Acknowledge the question immediately so they feel heard.",
      "Anchor price to size and condition — never give a random number.",
      "Ask for permission to continue so the call stays structured.",
    ],
    toneCue: "Steady and helpful — not defensive. You're solving, not dodging.",
    next: "s02",
  },
  {
    id: "b01c", parentId: "s01", label: "Rushed",
    title: "Client Is Rushed", subtitle: "Show respect for their time without giving up control.",
    script: `"Absolutely — I'll keep this quick. I just need two or three details so I don't give you the wrong number."`,
    keyPoints: [
      "Acknowledge that they're busy — don't fight it.",
      "Tell them you only need two or three details.",
      "Move straight into the highest-value qualifying questions.",
    ],
    toneCue: "Respect their pace, but don't rush YOUR process. Brief ≠ sloppy.",
    next: "s02",
  },
  {
    id: "b01d", parentId: "s01", label: "Vague",
    title: "Client Is Vague", subtitle: "Make the call feel easy by promising a guided process.",
    script: `"No problem — I'll make this easy. I'll ask a couple quick questions about the home and what you want cleaned, and then I'll guide you from there."`,
    keyPoints: [
      "Remove pressure by telling them you'll guide them.",
      "Move from general to specific: contact info, property details, priorities.",
      "Confidence matters more than speed here.",
    ],
    toneCue: "Calm and reassuring. They're unsure — your certainty is their anchor.",
    next: "s02",
  },
  {
    id: "s02", num: "02", label: "Info", main: true,
    title: "Contact Info", subtitle: "Capture their information before the call gets deeper.",
    script: `"Can I get your first and last name?"\n→ "What's the best email to send your quote?"\n→ "And is this the best number to reach you?"`,
    keyPoints: [
      "Ask for first and last name at the start of qualification.",
      "Get the best email so the quote has a destination.",
      "Confirm the best phone number while the conversation feels natural.",
      "If the call drops, you still own the lead.",
    ],
    toneCue: "Quick and natural — make this feel like paperwork, not an interrogation.",
    branches: [
      { targetId: "b02a", label: "Info resistance", color: "decision" },
    ],
    next: "s03",
  },
  {
    id: "b02a", parentId: "s02", label: "Resistance",
    title: "Info Resistance", subtitle: "Keep the request practical, not intrusive.",
    script: `"Totally understand — I just like to get your best contact info in case the call drops or I need to send the quote over. Then we'll keep moving."`,
    keyPoints: [
      "Frame it as protection in case the call drops.",
      "Tie the email directly to the quote.",
      "Get the info, then move on immediately — don't linger.",
    ],
    toneCue: "Light and casual. Don't make it a big deal — because it isn't.",
    next: "s03",
  },
  {
    id: "s03", num: "03", label: "Details", main: true,
    title: "Property Details", subtitle: "Gather the details that make the price feel accurate and justified.",
    script: `"I can see your house shows on Zillow as X sq ft, X bedroom and X baths — does that sound right?"\n→ "On a scale of 1–10, how dirty would you say it is? 1 is almost perfect, 10 needs a full reset."\n→ "When do you need the cleaning done — ASAP, or in the next week or two?"`,
    keyPoints: [
      "Look up the address on Zillow DURING the call for sq ft, beds, baths.",
      "Identify cleaning type: deep clean, move-in/out, post-construction, or maintenance.",
      "Use the 1–10 dirt scale to validate scope and protect the price.",
      'Ask the framing question: "Maintenance cleaning or a full reset?"',
    ],
    toneCue: "Expert mode. You're diagnosing, not order-taking. Ask with authority.",
    branches: [
      { targetId: "b03b", label: "Don't know sq ft", color: "decision" },
      { targetId: "b03c", label: '"Just regular cleaning"', color: "money" },
      { targetId: "b03d", label: "Skip deep clean → Ziah", color: "decision" },
      { targetId: "b03e", label: "Budget / a la carte", color: "money" },
    ],
    next: "s04",
  },
  {
    id: "b03b", parentId: "s03", label: "Unknown Sq Ft",
    title: "Unknown Details", subtitle: "If they're unsure, simplify and keep the quote moving.",
    script: `"That's okay — bedrooms, bathrooms, condition, and the areas that need the most attention are enough for me to size it out accurately."`,
    keyPoints: [
      "Don't stall the call because one detail is missing.",
      "Use bedrooms, bathrooms, condition, and pain points to size the job.",
      "Keep them talking about scope, not measurements.",
    ],
    toneCue: "Reassuring. You've done this hundreds of times — let that come through.",
    next: "s04",
  },
  {
    id: "b03c", parentId: "s03", label: "Regular Clean",
    title: '"Just Regular Cleaning"', subtitle: "Validate the goal, position deep cleaning as step one.",
    script: `"Got it — that's actually what most people are looking for long-term. What we've found is that the first cleaning usually needs a deeper reset before we can maintain it properly. So we typically start with a deep cleaning, and then from there we move into regular maintenance so it stays consistent."`,
    keyPoints: [
      "Validate their long-term goal — they're right about wanting maintenance.",
      "Position deep clean as a necessary first step, not an upsell.",
      `Use "what we've found" language — experience, not pressure.`,
    ],
    toneCue: "Consultative, not salesy. You're educating, not convincing.",
    branches: [
      { targetId: "b03d", label: '"Don\'t need deep clean"', color: "decision" },
      { targetId: "b03e", label: '"Something cheaper"', color: "money" },
    ],
    next: "s04",
  },
  {
    id: "b03d", parentId: "s03", label: "Ziah Path",
    title: "Skip Deep Cleaning", subtitle: "Use the Ziah assessment path — don't argue.",
    script: `"That's fair — and we can always confirm that. What we can do is have our field manager, Ziah, take a look and let you know if a deep cleaning is actually necessary or if we can go straight into maintenance. That way you're not paying for anything you don't need."`,
    keyPoints: [
      "Don't argue about whether they need a deep clean.",
      "Offer an in-person assessment through Ziah as a neutral expert.",
      "Frame it as protection — so they don't pay for what they don't need.",
    ],
    toneCue: "Collaborative. You're on their side. Ziah is the tiebreaker, not you.",
    next: "s04",
  },
  {
    id: "b03e", parentId: "s03", label: "A La Carte",
    title: "Budget Option", subtitle: "Offer a la carte only after deep cleaning has been positioned.",
    script: `"Got it — if you're looking to stay within a specific budget, we do have a more flexible option. We offer a la carte cleaning where we focus on priority areas. We set a timeframe — say 2 or 3 hours — and within that time we focus on whatever matters most. For 2 hours it's $120, for 3 hours it's $180."`,
    keyPoints: [
      "Frame a la carte as flexible, not lesser.",
      "Set a time box first, then define priorities inside that window.",
      "You only charge for time actually spent — mention this as a safety net.",
    ],
    toneCue: "Helpful, not defeated. You're offering a real solution, not a consolation prize.",
    next: "s04",
  },
  {
    id: "s04", num: "04", label: "Discover", main: true,
    title: "Light Discovery", subtitle: "One quick question gives you the pain and priorities you need to close later.",
    script: `"What made you decide to get a cleaning done now?"\n\nOR\n\n"What areas matter most to you?"`,
    keyPoints: [
      "Ask what made them decide to get a cleaning done NOW.",
      "Or ask which areas matter most: kitchen, bathrooms, floors, reset.",
      "Use their answer later when you justify value and close the booking.",
      "Pick one question and keep it short.",
    ],
    toneCue: "Listen more than you talk here. Their answer IS your closing argument later. Write it down.",
    extra: {
      title: "Common Pain Points to Listen For",
      items: [
        '"I don\'t have time" / "My weekends are consumed"',
        '"I\'m overwhelmed" / "I\'m embarrassed when people come over"',
        '"We\'ve tried others and weren\'t happy" / "They kept canceling"',
        '"I need it done before [event]" / "Moving in/out"',
        '"It\'s been months since a deep clean"',
      ],
    },
    next: "s05",
  },
  {
    id: "s05", num: "05", label: "Expect", main: true,
    title: "Set Expectation", subtitle: "Name the scope before you pause so the silence feels confident.",
    script: `"Got it — based on what you told me, I'm going to put together an estimate for a [deep cleaning / move-in/move-out / post-construction clean]. Give me one second."`,
    keyPoints: [
      "Don't go silent while you calculate — bridge the pause.",
      "Say the cleaning type out loud before the number lands.",
      '"Give me one second" sounds controlled and structured.',
      "If they push for price again, use the price-early branch.",
    ],
    toneCue: "Calm confidence. This pause is earned — you've done the work to get here.",
    next: "s06",
  },
  {
    id: "s06", num: "06", label: "Price", main: true,
    title: "Price Delivery", subtitle: "Never drop a bare number. Make it feel earned first.",
    script: `"So this would take about X hours with a team of two, and for a full deep cleaning, you're looking at $X."`,
    keyPoints: [
      "Lead with TIME: hours and team size.",
      "Name the SCOPE clearly: deep clean, move-in/out, post-construction.",
      "State the PRICE clearly once — no hedging, no apology.",
      "PAUSE after the number. Let them react. Silence is your friend.",
    ],
    toneCue: "Deliver the price like you believe in it — because you do. No apology. No flinch.",
    branches: [
      { targetId: "b06hes", label: "Hesitates / quiet", color: "money" },
      { targetId: "b06exp", label: '"That\'s expensive"', color: "danger" },
      { targetId: "b06cmp", label: "Comparing prices", color: "money" },
      { targetId: "b06chp", label: "Wants cheaper", color: "money" },
      { targetId: "b06neg", label: '"Can you do less?"', color: "money" },
      { targetId: "b06hrl", label: '"Why not hourly?"', color: "decision" },
    ],
    next: "s07",
  },
  {
    id: "b06hes", parentId: "s06", label: "Hesitation",
    title: "Price Hesitation", subtitle: "Reassure without talking yourself out of the price.",
    script: `"Totally fair — usually what people want to make sure of is that they're getting the right level of service. Based on the condition and the areas you mentioned, this is the level that gets it done right the first time."`,
    keyPoints: [
      "Treat hesitation like a need for clarity, not rejection.",
      "Reconnect the price to the condition and result.",
      "Keep tone steady and consultative — don't rush to fill silence.",
    ],
    toneCue: "Steady. Their silence isn't rejection — it's processing. Give them space.",
    branches: [{ targetId: "guar", label: "Deploy Guarantees", color: "success" }],
    next: "s07",
  },
  {
    id: "b06exp", parentId: "s06", label: "Too Expensive",
    title: '"That\'s Expensive"', subtitle: "Hold value with proof and risk reversal.",
    script: `"I completely understand — and just to be transparent, we're not the cheapest option, but we really stand behind the quality. We have over 800 five-star reviews and we're the top-rated company in St. Pete and Tampa. And we offer a 100% satisfaction guarantee — if anything's not right, we fix it. If you're still not happy, you get your money back. That's how confident we are."`,
    keyPoints: [
      "Acknowledge concern without shrinking the offer.",
      "One social proof: 800+ five-star reviews, top-rated locally.",
      "One risk reversal: satisfaction guarantee + money back.",
      "Frame it as getting it done right the first time.",
    ],
    toneCue: "Calm and transparent — not defensive. You're explaining value, not justifying cost.",
    branches: [{ targetId: "guar", label: "Full Guarantee Stack", color: "success" }],
    next: "s07",
  },
  {
    id: "b06cmp", parentId: "s06", label: "Comparing",
    title: "Comparing Prices", subtitle: "Help them compare scope, not just the number.",
    script: `"That makes sense — most people do. What I'd say is just make sure you're comparing the same level of service. Two quotes can look similar on price but be very different in scope, detail, and results."`,
    keyPoints: [
      "Validate that comparing is normal — don't get defensive.",
      "Make sure they compare the same service level.",
      "Point to detail, reliability, and outcome as differentiators.",
      '"What\'s more important — saving $50 or knowing it\'s handled right?"',
    ],
    toneCue: "Confident, not threatened. You've seen this before and the result speaks.",
    next: "s07",
  },
  {
    id: "b06chp", parentId: "s06", label: "Cheaper",
    title: "Wants Cheaper", subtitle: "Protect positioning, then offer scope adjustment.",
    script: `"Totally fair — a lot of people look at a few options before deciding. The main difference usually comes down to detail and reliability. We can absolutely tailor the cleaning to focus on what matters most and adjust the scope if needed."`,
    keyPoints: [
      "Validate the budget concern first.",
      "Reframe difference as scope, detail, reliability.",
      "Offer a narrower version — the a la carte path.",
      "Only discount scope, never quality.",
    ],
    toneCue: "Understanding but firm on value. Flexibility on scope, not on standards.",
    next: "s07",
  },
  {
    id: "b06neg", parentId: "s06", label: "Negotiate",
    title: '"Can You Do It For Less?"', subtitle: "Empathize → Reframe → Lead. Never defend — reaffirm value.",
    script: `"I appreciate you asking. Here's the thing — I could lower the price, but I'd have to remove things to make that work. I could take out the inside of appliances, skip the baseboards, or cut the detail work.\n\nBut then you wouldn't be getting the full experience — the reason people hire us.\n\nWould you rather have the full service where everything's handled perfectly, or would you prefer I customize a lighter package?"`,
    keyPoints: [
      'Never just say "no" — show what would be removed.',
      "Make the trade-off visible: lower price = less service.",
      "Let them choose: full experience or customized lighter package.",
      '"What\'s your budget? I\'ll tell you what we can prioritize."',
    ],
    toneCue: "No apology. You're being transparent about what the price buys.",
    next: "s07",
  },
  {
    id: "b06hrl", parentId: "s06", label: "Why Hourly?",
    title: '"Why Not Hourly?"', subtitle: "Turn a question into a selling point.",
    script: `"Good question — it's different from what you might be used to. We used to charge hourly, and here's what we found: when you charge by the hour, the cleaner's incentive is to work fast to get to the next job. Rushing, cutting corners, 'good enough' work.\n\nWe price based on your home's size and condition — not time. So our team's only focus is doing it RIGHT, not fast. You get better results and don't feel nickel-and-dimed."`,
    keyPoints: [
      "Validate their question — it IS different.",
      "Explain the perverse incentive of hourly (rush to finish).",
      "Position flat-rate as better for client: quality over speed.",
      'End with: "Does that make sense?"',
    ],
    toneCue: "Educational, not defensive. You're sharing an insight, not arguing.",
    next: "s07",
  },
  {
    id: "s07", num: "07", label: "Value", main: true,
    title: "Value Snapshot", subtitle: "Keep it short, concrete, and outcome-based.",
    script: `"That includes a full top-to-bottom service — kitchen, bathrooms, baseboards, floors, surfaces — everything brought back to the condition you need."`,
    keyPoints: [
      "Don't read the full checklist — name the key zones.",
      "Kitchen, bathrooms, baseboards, floors, surfaces — that's enough.",
      'End on a result phrase: "reset condition" or "the way you want it."',
      "If you feel yourself listing more, stop. Short = confident.",
    ],
    toneCue: "Confident brevity. You've already built the value — now land the plane.",
    branches: [{ targetId: "guar", label: "Deploy Guarantees (if needed)", color: "success" }],
    next: "s08",
  },
  {
    id: "s08", num: "08", label: "Close", main: true,
    title: "Transition to Close", subtitle: "Move the decision from whether to book to when to book.",
    script: `"Right now I have availability at 9 AM sharp on [Day, Date]. Would that work for you?"`,
    keyPoints: [
      "Offer a SPECIFIC day and time — vague offers feel less real.",
      "Ask WHEN they want to book, not IF.",
      "If they hesitate, use the objection branches below.",
      'Assumptive language: "When we get started" not "If you decide to."',
    ],
    toneCue: 'Assume the sale. Your tone should say "this is happening" — not "what do you think?"',
    branches: [
      { targetId: "b08thk", label: "Need to think", color: "money" },
      { targetId: "b08spo", label: "Talk to spouse", color: "decision" },
      { targetId: "b08fch", label: "Found cheaper", color: "danger" },
      { targetId: "b08qua", label: "Quality concern", color: "decision" },
      { targetId: "b08str", label: "Strangers concern", color: "decision" },
    ],
    next: "s09",
  },
  {
    id: "b08thk", parentId: "s08", label: "Think",
    title: '"I Need to Think"', subtitle: "Surface the real hesitation without sounding pushy.",
    script: `"No problem at all — I'd never want you to feel rushed. Can I ask — what specifically are you thinking through? Is it the investment, the timing, or whether we're the right fit?"`,
    keyPoints: [
      "Don't chase with discounts or rambling.",
      "Identify the REAL objection: price, timing, trust, or scope.",
      "Route to the matching branch once they tell you.",
      "If still unsure: send everything in writing, follow up in 1-2 days.",
    ],
    toneCue: "Calm and curious. You're a detective here, not a closer.",
    next: "s09",
  },
  {
    id: "b08spo", parentId: "s08", label: "Spouse",
    title: '"Talk to My Spouse"', subtitle: "Empathize → Surface real concern → Offer follow-up path.",
    script: `"Of course — totally understand. It's your home together, so you should both be on board.\n\nCan I ask — what do you think they'll be most concerned about? Is it the investment, the scheduling, or just making sure we're trustworthy?"\n\n→ After they answer:\n"Got it. I'll email you everything so you can review together — pricing, what's included, the guarantees. But I want to mention, we only have a few spots left this month, so I'd recommend circling back soon."`,
    keyPoints: [
      "They'll usually reveal the REAL objection when you ask about spouse's concern.",
      "Send everything in writing so they have ammo to convince their partner.",
      "Light urgency: limited spots. Don't fake it — use real availability.",
    ],
    toneCue: "Respectful and understanding. No pressure — just smart follow-through.",
    next: "follow",
  },
  {
    id: "b08fch", parentId: "s08", label: "Cheaper",
    title: '"Found Someone Cheaper"', subtitle: "Empathize → Flip with curiosity → Lead to value.",
    script: `"I appreciate you being honest. Can I ask — if they're cheaper, what made you reach out to us instead of just booking with them?"\n\n→ Listen. They'll reveal: trust, quality, consistency.\n\n"Right — and that's exactly why we charge what we do. You're paying for reliability, background checks, consistency, and guarantees. If price is the only thing that matters, we're probably not the right fit. But if you want it done right — that's what we do."`,
    keyPoints: [
      "The curiosity question is GOLD — they sell themselves on you.",
      "They called you for a reason despite the cheaper option. Find it.",
      "Don't trash the competitor. Let the comparison speak.",
      '"What\'s more important — saving $50 or knowing it\'s handled right?"',
    ],
    toneCue: "Curious, not competitive. Let them talk themselves into the answer.",
    next: "s09",
  },
  {
    id: "b08qua", parentId: "s08", label: "Quality",
    title: '"What If I Don\'t Like It?"', subtitle: "Lead with the Happiness Promise.",
    script: `"That's a fair concern — you don't know us yet. That's exactly why we offer the Happiness Promise. If you're not thrilled — for any reason — we come back within 24 hours and make it right at no charge. And if you're still not happy, you don't pay.\n\nWe have 800+ five-star reviews because we don't leave until it's right."`,
    keyPoints: [
      "Validate — it's reasonable for a first-time client.",
      "Lead with the guarantee, then back it with social proof.",
      'End with: "Does that put your mind at ease?"',
    ],
    toneCue: "Empathetic and confident. Their concern is valid — your answer is rock solid.",
    branches: [{ targetId: "guar", label: "Full Guarantee Stack", color: "success" }],
    next: "s09",
  },
  {
    id: "b08str", parentId: "s08", label: "Strangers",
    title: '"Worried About Strangers"', subtitle: "Acknowledge, then stack trust signals.",
    script: `"Totally understand — it's your home, your safe space. That's a big deal.\n\nEvery person on our team goes through a full background check before they ever step foot in a client's home. We carry full insurance and bonding — liability and workers' comp.\n\nAnd once you have your first cleaning, you get the same team every time when possible — so it's not strangers anymore, it's familiar faces who know your home."`,
    keyPoints: [
      "Validate — this is emotional, not logical. Respect that.",
      "Stack trust: background checks, insurance, bonding.",
      'The "same team" promise is powerful for this objection.',
      'End with: "Does that help?"',
    ],
    toneCue: "Warm and serious. This isn't a sales moment — it's a trust moment.",
    next: "s09",
  },
  {
    id: "s09", num: "09", label: "Schedule", main: true,
    title: "Scheduling", subtitle: "Offer two real options so the decision feels easy.",
    script: `"I have [Day] at [Time], or I could do [Day] [morning/afternoon] — which works better for you?"`,
    keyPoints: [
      "Give TWO specific choices — not open-ended.",
      "Guide toward what works for YOUR schedule.",
      "Confirm the exact day and time before deposit.",
      '"Perfect, so we\'re set for [Day] at [Time]."',
    ],
    toneCue: "Efficient and clear. This is logistics, not selling. Keep the momentum.",
    next: "s10",
  },
  {
    id: "s10", num: "10", label: "Deposit", main: true,
    title: "Recap + Deposit", subtitle: "Confirm the booking, then ask for the 30% deposit.",
    script: `"Alright — we're set for [Day] at [Time] for the [cleaning type]. To lock that in, we just take a 30% deposit, otherwise I can't guarantee the spot.\n\nI can help you with that now, or you can do it through the quote I'll send. Which works?"`,
    keyPoints: [
      "Recap day, time, and cleaning type OUT LOUD — makes it feel real.",
      'Frame deposit as "just 30%" to soften the ask.',
      "Offer two payment paths: now with you, or through the quote.",
      "Cash option: 5% discount if they pay cash after.",
    ],
    toneCue: "Matter-of-fact. The deposit is standard — treat it that way.",
    branches: [{ targetId: "b10a", label: "Deposit resistance", color: "money" }],
    next: "s11",
  },
  {
    id: "b10a", parentId: "s10", label: "Resistance",
    title: "Deposit Resistance", subtitle: "Reduce friction without giving up the requirement.",
    script: `"Absolutely — the deposit just locks the time so the slot doesn't get taken. I can help you now, or I send the quote and you handle it there. As soon as it's in, the booking is confirmed."`,
    keyPoints: [
      "Keep deposit positioned as standard, not personal.",
      "Tie it to holding the calendar slot.",
      "Same two paths: now or through the quote.",
      '"I totally understand. I\'ll send the quote and you can take care of it when ready."',
    ],
    toneCue: "Firm but easy. The deposit isn't negotiable — but the HOW is flexible.",
    next: "s11",
  },
  {
    id: "s11", num: "11", label: "Setup", main: true,
    title: "Post-Close Setup", subtitle: "Tighten the experience and quietly create add-on space.",
    script: `"Perfect — to make sure everything goes smoothly on the day of the cleaning, I'll go over a few quick details with you."`,
    keyPoints: [
      "Parking: driveway, street, guest parking, or door-entry instructions.",
      "Access: will they be home, lockbox, or door code?",
      "Trash: trash cans or dumpster nearby?",
      "Flooring: hardwood, tile, vinyl, carpet?",
      "Confirm bedrooms and bathrooms again.",
      "Pets: type, size, will they be home?",
      "Focus areas: any zones needing extra attention?",
      "Add-ons: oven, fridge, cabinets, drawers, interior windows?",
    ],
    toneCue: "Thorough but quick. This is service, not selling. They already bought.",
    extra: {
      title: "Common Add-Ons (Reference)",
      items: [
        "Interior windows — $10/window (typically $80–120 total)",
        "Inside refrigerator — emptied, wiped, sanitized ($70)",
        "Inside oven — racks, walls, glass, degreased ($60)",
        "Interior glass doors — streak-free ($30 each)",
        "Interior cabinets — emptied and wiped ($80)",
        "Laundry — one cycle washed, dried, folded ($35)",
      ],
    },
  },
  // ── SPECIAL SECTIONS ──
  {
    id: "guar", num: "G", label: "Guarantees", main: true, special: true,
    title: "Guarantee Stack", subtitle: "Deploy these when you need risk reversal. Use 1, 2, or all 3.",
    guarantees: [
      {
        name: "THE HAPPINESS PROMISE",
        color: "#059669",
        script: `"If we finish and you're not thrilled — for any reason — we come back within 24 hours and make it right. No charge. No questions. You don't pay for something you're not happy with."`,
      },
      {
        name: "DAMAGE PROTECTION PLEDGE",
        color: "#7c3aed",
        script: `"We carry full insurance and bonding. If anything gets damaged — and in seven years, it's happened twice — we repair or replace it at full value. You're covered up to $1 million."`,
      },
      {
        name: "ON-TIME GUARANTEE",
        color: "#0891b2",
        script: `"If we're more than 15 minutes late, that day's cleaning is 50% off. If we no-show — which has never happened — it's free. You have zero risk."`,
      },
    ],
    toneCue: 'Let each guarantee land. Pause between them. End with: "Make sense?"',
  },
  {
    id: "follow", num: "F", label: "Follow-Up", main: true, special: true,
    title: "Follow-Up Cadence", subtitle: "When they don't book — your 3-day recovery plan.",
    followUp: [
      {
        day: "DAY 1 — Same day",
        content: `Call #1 (ASAP) — Full script. If voicemail:\n"Hi [Name], this is Andre with Joy of Cleaning. I'd love to learn more about your cleaning needs and how we can help you get your time back. Give me a call at [number]."\nCall #2 (later same day) — No voicemail.`,
      },
      {
        day: "DAY 2 — Next day",
        content: `Call #3 (morning) — Voicemail:\n"Hi [Name], following up from Joy of Cleaning. I want to make sure I can answer any questions and get you on the schedule before we fill up this month. Call me at [number]."\nCall #4 (afternoon) — No voicemail.`,
      },
      {
        day: "DAY 3 — Final attempt",
        content: `Call #5 (morning) — Final voicemail:\n"Hi [Name], this is Andre from Joy of Cleaning one last time. I don't want to be a pest, but I also don't want you to miss out. If you're still interested, call me at [number]. If not, totally fine."\nAfter Day 3: Stop manual calls. Let CRM take over.`,
      },
    ],
    toneCue: "Each voicemail should sound like a real person, not a script. Smile when you record.",
  },
  {
    id: "recur", num: "R", label: "Recurring", main: true, special: true,
    title: "Post-Clean Conversion", subtitle: "Call 1-2 days after the deep clean to convert to recurring.",
    script: `"Hi [Name], this is Andre from Joy of Cleaning. I just wanted to check in — how did everything go with your deep clean on [Day]?"\n\n→ Let them respond (usually positive).\n\n"That's awesome. A lot of our clients who start with a deep clean love how it feels, and then they set up recurring service — usually bi-weekly — so their home stays in that 'just cleaned' state.\n\nBased on your home, bi-weekly would be around $[XXX], same team so they know your space.\n\nDoes that sound like something you'd want to set up?"`,
    keyPoints: [
      'If YES: "Perfect. What day of the week works best?"',
      'If NOT YET: "No problem. After six cleanings, your 7th is free."',
    ],
    toneCue: "Warm check-in energy, not sales call energy. They already trust you.",
  },
];

export const DEFAULT_FLOWS = {
  "website-lead": { id: "website-lead", steps: WL_STEPS },
};

export const DEFAULT_GROUPS = [
  { id: "website", name: "Website", icon: "🌐", order: 0 },
  { id: "inbound", name: "Inbound", icon: "📞", order: 1 },
  { id: "outbound", name: "Outbound", icon: "📤", order: 2 },
  { id: "voicemail", name: "Voicemail", icon: "📬", order: 3 },
  { id: "gatekeeper", name: "Gatekeeper", icon: "🤖", order: 4 },
];

export const DEFAULT_FLOW_GROUP_MAP = {
  "website-lead": "website",
  "inbound-no-quote": "inbound",
  "inbound-has-quote": "inbound",
  "outbound-post-quote": "outbound",
  "outbound-no-reply": "outbound",
  "voicemail": "voicemail",
  "gatekeeper": "gatekeeper",
};

export function buildSeedWorkspace() {
  const emptyFlows = CALL_TYPES.map((type, index) => ({
    id: type.id,
    name: type.name,
    icon: type.icon,
    desc: type.desc,
    groupId: DEFAULT_FLOW_GROUP_MAP[type.id] || DEFAULT_GROUPS[0].id,
    order: index,
    steps: [],
  }));

  const workspaceFlows = emptyFlows.map((flow) => {
    const seeded = DEFAULT_FLOWS[flow.id];
    if (!seeded) return flow;
    return {
      ...flow,
      steps: (seeded.steps || []).map((step, stepIndex) => ({
        order: step.order ?? stepIndex,
        main: step.main ?? false,
        special: step.special ?? false,
        keyPoints: step.keyPoints || [],
        branches: step.branches || [],
        ...step,
      })),
    };
  });

  return {
    groups: DEFAULT_GROUPS.map((group, index) => ({ ...group, order: group.order ?? index })),
    flows: workspaceFlows,
    theme: "dark",
  };
}
