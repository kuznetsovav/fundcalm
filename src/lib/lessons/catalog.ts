import type { Lesson } from "./types";

// ---------------------------------------------------------------------------
// Pillar 1 — Survival
// ---------------------------------------------------------------------------

const SURVIVAL: Lesson[] = [
  {
    slug: "runway-is-freedom",
    pillar: "survival",
    title: "Runway is freedom",
    hook: "The first thing money buys you is the right to say no.",
    estMinutes: 3,
    speaksTo: ["income_loss", "making_mistake"],
    paragraphs: [
      "Most people think of money as something to grow. Before it can grow, it has to protect. Runway — the number of months your cash covers your spending — is the cleanest measure of that protection.",
      "Runway is not about being rich. It's about how many decisions you can make freely before money makes them for you. With one month of runway, every job is a job you can't walk away from. With six, you can take a week to think. With eighteen, you can take risks that compound for years.",
      "The mistake is to treat cash as wasted. A buffer that earns nothing in a savings account is not idle money — it's an option. The option to leave a bad situation, to wait out a market, to not sell at the worst possible time. That option is worth far more than the interest you're missing.",
      "Build runway first. Everything else — investing, side income, long-term planning — works better from a base of calm.",
    ],
    exercise:
      "How many months of runway do you have right now? How many would let you sleep at night?",
  },
  {
    slug: "the-math-of-ruin",
    pillar: "survival",
    title: "The math of ruin",
    hook: "Most strategies look great until the one bad outcome ends the game.",
    estMinutes: 4,
    speaksTo: ["income_loss", "market_crash"],
    paragraphs: [
      "Imagine a coin flip. Heads, you double your money. Tails, you lose half. The expected value is positive — on paper, you should keep playing. In practice, after enough flips, almost everyone goes broke.",
      "This is the math of ruin. When losses compound, they don't average out. Losing 50% requires a 100% gain to recover. Two bad years can erase ten good ones. And once you reach zero, you don't get to play the next round.",
      "Almost every financial disaster in history has the same shape: someone optimised for the average case and ignored the tail. Big leverage, no buffer, all eggs in one basket — strategies that work in 19 of 20 years and end careers in the 20th.",
      "The lesson is simple but unfashionable: avoid ruin first, and the rest takes care of itself. Refuse any single bet that could end the game, even if it's a great expected value. Boring beats clever, repeatedly, over a lifetime.",
    ],
    exercise:
      "Where in your finances could one bad event take you to zero? What would it cost to make that impossible?",
  },
  {
    slug: "antifragile-income",
    pillar: "survival",
    title: "Antifragile income",
    hook: "One income stream is fragile. Two unrelated ones are something else entirely.",
    estMinutes: 3,
    speaksTo: ["income_loss"],
    paragraphs: [
      "A single salary feels safe until the day it isn't. Layoffs, illness, an industry shift — the structure that paid your bills for ten years can disappear in a quarter. Most people respond to this risk by saving harder. Saving helps, but it's defensive. The asymmetric move is to add a second, unrelated stream of income.",
      "Unrelated is the key word. Two consulting clients in the same industry are one stream. A salary plus dividends from the same company are one stream. Real diversification means streams that don't fail together: a job and a small product, a salary and rental income, a steady gig and a weekend skill that pays.",
      "The second stream rarely starts as much. A few hundred a month is normal in year one. The point is not the income — it's the optionality. Once the second stream exists, you negotiate differently, you sleep differently, you take different risks.",
    ],
    exercise:
      "If your main income disappeared tomorrow, what would you do in week one? Could that thing become a small stream now?",
  },
  {
    slug: "redundant-not-redundant",
    pillar: "survival",
    title: "Redundant cash isn't redundant",
    hook: "The cash that earns nothing is the cash that pays for itself in the year it's needed.",
    estMinutes: 3,
    speaksTo: ["missing_opportunities", "market_crash"],
    paragraphs: [
      "There's a common argument: cash loses to inflation, so any extra cash is wasted. The argument is right about the math and wrong about the reality.",
      "Cash isn't an asset class — it's an option contract. It pays you nothing in calm years and everything in chaotic ones. The year a market drops 40%, the year an unexpected medical bill arrives, the year a job ends — that's the year cash earns its return, all at once.",
      "Investors who don't keep cash are forced sellers. They sell investments at the worst possible time, lock in losses, and miss the recovery. Investors with cash buy when others can't. The same dollar, held in cash for ten boring years, becomes the dollar that buys the bargain.",
      "Yes, you'll lose a small amount to inflation. You'll gain a much larger amount in not making forced decisions under pressure. That's the trade.",
    ],
  },
  {
    slug: "the-three-shocks",
    pillar: "survival",
    title: "The three shocks",
    hook: "Most financial pain comes from one of three places. You can plan for all of them.",
    estMinutes: 4,
    paragraphs: [
      "Almost every financial crisis a person faces is one of three shocks: an income shock, an expense shock, or an asset shock.",
      "The income shock is the obvious one — a layoff, a business slowdown, a client that disappears. Buffer plus a second income stream covers most of these.",
      "The expense shock is the surprise: a medical bill, a roof, a parent who needs help. These rarely show up in budgeting spreadsheets. The protection is a true emergency fund, separate from your normal buffer, untouchable except for actual emergencies.",
      "The asset shock is the slowest and the most damaging — a market drawdown right when you need to sell, a property that won't sell at the price you assumed. The protection here is liquidity: keeping enough of your wealth in cash and stable assets that you never have to sell the volatile stuff at the wrong time.",
      "Plan for all three separately. They feel similar from far away but require different defences.",
    ],
    exercise:
      "Which of the three shocks are you least protected against today? What's one move that would change that?",
  },
];

// ---------------------------------------------------------------------------
// Pillar 2 — Enough
// ---------------------------------------------------------------------------

const ENOUGH: Lesson[] = [
  {
    slug: "define-your-number",
    pillar: "enough",
    title: "Define your number",
    hook: "Freedom isn't a feeling. It's a number you can write down.",
    estMinutes: 4,
    speaksTo: ["making_mistake", "missing_opportunities"],
    paragraphs: [
      "Most people chase wealth without ever deciding how much is enough. The result is a treadmill — every milestone replaced by the next, every raise absorbed by lifestyle, no point at which you can stop.",
      "Defining your number isn't materialistic. It's the opposite. Your number is the cost of the life you actually want to live, multiplied by enough years to last. It's a target, not a maximum.",
      "Start with annual expenses. Not aspirational ones — real ones, the ones you have today plus a buffer. Multiply by 25. That's roughly the amount that, conservatively invested, would cover those expenses indefinitely. It's your freedom number.",
      "The number will probably be smaller than you assume. Most lifestyles can be sustained on far less than the careers built to fund them. The work is to know your number, not to maximise it.",
      "Once you have a number, the question stops being 'how much can I make?' and becomes 'how close am I to enough?' That single shift changes how you spend, how you work, and what you say yes to.",
    ],
    exercise:
      "What does a year of the life you want actually cost? Multiply by 25. Sit with the number.",
  },
  {
    slug: "lifestyle-creep",
    pillar: "enough",
    title: "Lifestyle creep is the silent thief",
    hook: "Every raise quietly raises your freedom number too. That's the trap.",
    estMinutes: 3,
    speaksTo: ["making_mistake", "missing_opportunities"],
    paragraphs: [
      "When income goes up, two things can happen. Either your savings rate goes up, or your spending goes up. The default for most people is the second — and it doesn't feel like a choice.",
      "A nicer apartment after a promotion. A car upgrade you've earned. A gym membership, a streaming bundle, a weekly takeaway you didn't have when you made less. Each one feels small. Together they shift your baseline upward, permanently.",
      "Lifestyle creep is dangerous because it raises both sides of the equation. You earn more, but your freedom number — the amount that funds your life — has gone up too. You can run faster and stay in the same place.",
      "The fix isn't austerity. It's awareness. When income rises, decide before it arrives what fraction goes to savings and what fraction to lifestyle. The rule doesn't have to be strict. It just has to be conscious.",
    ],
    exercise:
      "Compare your spending now to your spending three years ago. What changed? Was it worth what it cost in freedom?",
  },
  {
    slug: "the-hedonic-treadmill",
    pillar: "enough",
    title: "The hedonic treadmill",
    hook: "The new car feels amazing for six weeks. Then it's just the car.",
    estMinutes: 3,
    paragraphs: [
      "Humans adapt. It's a survival trait — the ability to settle into any environment, good or bad — and it quietly defeats most spending.",
      "The new car, the bigger apartment, the better phone: they all feel transformative for a few weeks, then become invisible. The pleasure fades, but the cost doesn't. You paid forever for a feeling that lasted a season.",
      "This isn't an argument against ever spending on yourself. It's an argument for spending on things that resist adaptation. Experiences, time with people, skills, freedom from things you don't want to do — these tend to keep paying out.",
      "Test it on yourself: think of the most expensive thing you bought in the last five years. How much pleasure does it still give you, weekly, today? Compare that to the cheaper purchases that still make you smile.",
    ],
  },
  {
    slug: "conscious-spending",
    pillar: "enough",
    title: "Conscious spending",
    hook: "Cut hard on what you don't care about. Spend without guilt on what you do.",
    estMinutes: 3,
    paragraphs: [
      "Frugality without joy is just suffering. The point of conscious spending isn't to spend less — it's to spend on what actually matters to you, and to ruthlessly cut everything else.",
      "Most budgets fail because they treat all spending as equal. Coffee, books, restaurants, clothes — every category gets the same scrutiny. The result is a budget that fights you on every purchase and that you eventually abandon.",
      "Conscious spending flips this. You pick a few categories you genuinely love and spend generously there, with no guilt. Everything else gets cut to the bone. If you love books, buy ten a month. If you don't care about cars, buy the cheapest reliable one. Most people who try this discover they were spending heavily on things they didn't actually want.",
      "Done well, conscious spending raises your savings rate and your enjoyment at the same time. The two aren't opposites — most people are doing both worse than they need to.",
    ],
    exercise:
      "Name three spending categories you genuinely love. Name three you spend on out of habit. Cut one of the second list this month.",
  },
  {
    slug: "the-stop-line",
    pillar: "enough",
    title: "The stop line",
    hook: "The hardest thing about wealth isn't earning it. It's knowing when to stop.",
    estMinutes: 3,
    speaksTo: ["missing_opportunities"],
    paragraphs: [
      "Almost everyone who ends up overworked, burnt out, or pushed into bad investments was past their freedom number when it happened. They didn't know where to stop because they'd never drawn the line.",
      "The stop line is the level of wealth at which more money no longer meaningfully changes your life. Above the line, you're trading time and risk for a number that doesn't buy anything different. The yacht doesn't make you happier. The fifth zero doesn't change your day.",
      "Drawing the line in advance protects you from your future self. Once the line is drawn, you can say no. You can take the calmer job, the smaller deal, the slower path. You can keep playing without needing to win again.",
      "The line isn't permanent. You can move it. But you should know where it is, and you should stop when you reach it — at least long enough to ask whether the next push is something you actually want.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Pillar 3 — Time
// ---------------------------------------------------------------------------

const TIME: Lesson[] = [
  {
    slug: "money-is-stored-time",
    pillar: "time",
    title: "Money is stored time",
    hook: "Every pound in savings is an hour you don't have to sell to anyone.",
    estMinutes: 3,
    paragraphs: [
      "Money is the most useful abstraction for one reason: it converts cleanly into time. Anything you save is an hour, a day, a week of life that you don't owe to a job, a client, or a bill.",
      "Most people experience this in reverse — they trade time for money. The trade feels permanent because it's how the world works. But savings reverse it: stored money becomes future time, and the conversion rate is your annual expenses.",
      "Once you see savings as stored time, the math of freedom becomes obvious. A year's worth of expenses in the bank equals a year of unscheduled life. Twenty-five years of expenses, conservatively invested, equals a lifetime.",
      "The question stops being 'am I rich?' and becomes 'how much of my time do I own?'",
    ],
  },
  {
    slug: "savings-rate-is-the-lever",
    pillar: "time",
    title: "Savings rate is the lever",
    hook: "Years to freedom depends on one number more than any other.",
    estMinutes: 4,
    paragraphs: [
      "There's a small piece of arithmetic that changes how most people think about freedom. Years to financial independence depends almost entirely on your savings rate — the fraction of your income you keep — and almost not at all on how much you earn.",
      "Save 10% of your income, and a working life of about 50 years funds your retirement. Save 25%, and it drops to roughly 30 years. Save 50%, and you reach freedom in about 17 years. Save 65%, and the number is closer to 10.",
      "Income matters, but only because it makes high savings rates easier. A doctor saving 15% reaches freedom slower than a teacher saving 50%. The lever isn't the size of the paycheck — it's the gap between what you earn and what you spend.",
      "This is why people who get a raise and don't change their lifestyle become wealthy quickly. Every extra pound goes to savings, every percentage point of savings rate cuts years off the timeline. The compounding works on the rate, not just the amount.",
    ],
    exercise:
      "What's your current savings rate? What rate would you need to reach freedom in 20 years? In 15?",
  },
  {
    slug: "the-4-percent-rule",
    pillar: "time",
    title: "The 4 percent rule, simply",
    hook: "Twenty-five times your annual expenses is the line where work becomes optional.",
    estMinutes: 3,
    paragraphs: [
      "The most useful piece of financial math is also one of the simplest: 25 times your annual expenses, conservatively invested, will fund those expenses indefinitely.",
      "The rule comes from decades of historical analysis of stock and bond returns. It assumes you withdraw about 4% of the portfolio each year, adjusted for inflation. In almost every 30-year window in market history, that withdrawal rate has lasted without depleting the principal.",
      "It's not a guarantee. Markets can do anything. The rule has caveats: very long retirements need a lower rate, very high inflation needs a buffer, sequence-of-returns risk in the first decade matters most. But as a target — a definition of 'enough' — it's hard to beat.",
      "Spend £40,000 a year? Your number is roughly £1m. Spend £20,000? Your number is £500k. The simplicity of the math is part of the point: freedom isn't mysterious, it's just a multiplier away.",
    ],
    exercise:
      "Multiply your real annual spending by 25. That's your number. How does it compare to what you'd guessed?",
  },
  {
    slug: "freedom-from-vs-to",
    pillar: "time",
    title: "Freedom from vs freedom to",
    hook: "Most people optimise for the wrong one without realising.",
    estMinutes: 3,
    paragraphs: [
      "There are two kinds of freedom that money buys, and they're not the same.",
      "Freedom from is the ability to stop doing things — to quit the bad job, to leave the city, to refuse the project that pays well and feels wrong. It's negative space. It grows with your buffer and your savings.",
      "Freedom to is the ability to start doing things — to take the risky bet, to fund the project no one will pay you for, to spend a year on something with no clear payoff. It's positive space. It grows with your surplus, not your buffer.",
      "Most people focus on one and quietly ignore the other. Workaholics optimise for freedom-to, building wealth they never use. Anxious savers optimise for freedom-from, building safety they never spend. Both feel productive. Neither, alone, is the goal.",
      "The full picture is having enough buffer to say no, and enough surplus to say yes. Different numbers, different times in life, different ratios. Knowing which one you currently lack is half the work.",
    ],
  },
  {
    slug: "compounding-takes-time",
    pillar: "time",
    title: "Compounding looks like nothing for years",
    hook: "Year five is when it stops being a chart and starts being your life.",
    estMinutes: 3,
    paragraphs: [
      "If you put £500 a month into a broad investment account at a typical long-term return, year one looks unremarkable. You contributed £6,000. You have, maybe, £6,300. The growth is rounding error.",
      "Year five is roughly £35,000 — slightly more than what you put in. Year ten is around £85,000. Year twenty is past £270,000. Year thirty is past £700,000. The graph that started flat starts to bend, and then it stops being a line and becomes a curve.",
      "Most people quit before the curve. The first few years feel like nothing is happening because, on a percentage basis, nothing is. Compounding is the multiplication of time and base — and in early years, both are small.",
      "The lesson is to stay in long enough for the math to work. The boring middle of any compounding journey is when it looks like a waste of effort. It's also exactly the period that makes the later part possible.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Pillar 4 — Leverage
// ---------------------------------------------------------------------------

const LEVERAGE: Lesson[] = [
  {
    slug: "earn-more-vs-save-more",
    pillar: "leverage",
    title: "Earn more vs save more",
    hook: "Saving has a floor. Earning has a ceiling that's much further away.",
    estMinutes: 3,
    paragraphs: [
      "Once you've covered the basics — built a buffer, cut the obvious waste, saved a sensible fraction — there's a quiet asymmetry between cutting expenses and growing income.",
      "Cutting expenses has a floor. You can only spend so little. Beyond a certain point, every additional cut costs you quality of life for diminishing returns.",
      "Growing income doesn't have a near floor or near ceiling. The same hour of work can pay £20 or £2,000 depending on the kind of work, the leverage involved, and the position you've built. Doubling your income changes your trajectory more than halving your expenses ever could.",
      "This isn't an argument against frugality — frugality builds the discipline that lets you keep what you earn. It's an argument against spending all your effort there. After the basics, the bigger lever is on the income side, and most people don't push hard enough on it.",
    ],
    exercise:
      "Where would an extra £500/month come from? What would it take to double your income in five years?",
  },
  {
    slug: "specific-knowledge",
    pillar: "leverage",
    title: "Specific knowledge",
    hook: "What only you can do is what you should be paid most for.",
    estMinutes: 4,
    paragraphs: [
      "Specific knowledge is the kind of expertise that can't be trained for in a classroom. It comes from genuine curiosity, time spent on things that didn't seem useful, and a particular combination of skills that's rare because it's specific to you.",
      "Generic skills get paid generic rates. The market for spreadsheet work, basic coding, standard marketing — these are crowded. The supply is high. Wages reflect the supply.",
      "Specific knowledge is uncrowded by definition. If you've spent years on the intersection of two unrelated fields, you're often the only person on the planet who can do exactly what you do. The pricing changes when you're the only option.",
      "The clearest test for specific knowledge: it feels like play to you and like work to others. The thing you naturally read about, talk about, dig into for free is your strongest signal. Most people ignore it because it doesn't look like a career path. Career paths are exactly where specific knowledge isn't.",
    ],
    exercise:
      "What do you know more about than almost anyone you know? What combination of two interests is unusual in your work?",
  },
  {
    slug: "four-types-of-leverage",
    pillar: "leverage",
    title: "Four types of leverage",
    hook: "You can multiply your effort with capital, code, content, or other people's time.",
    estMinutes: 4,
    paragraphs: [
      "Leverage is what separates earning more by working harder from earning more by working differently. There are four kinds, in roughly increasing order of accessibility.",
      "Capital leverage is the oldest. Money makes more money. It works at scale and requires having capital to start, which most people don't.",
      "Labour leverage is the next: hiring people, building a team, multiplying yourself through other humans. It works but it's hard. Managing people is its own full-time job, and most early attempts fail.",
      "Then there are the modern, permissionless ones. Code leverage means building software that runs without you — once written, it serves a thousand users as easily as one. Content leverage is similar: a good piece of writing, a good video, a good course continues to work in your absence.",
      "Code and content are remarkable because they require no permission, no capital, and very little starting cost. They're also the slowest to start working. Both reward depth over speed: one excellent thing beats a hundred mediocre ones, and the second decade outperforms the first by a wide margin.",
    ],
  },
  {
    slug: "equity-not-wages",
    pillar: "leverage",
    title: "Equity, not wages",
    hook: "Wages buy your time once. Equity pays you while you sleep.",
    estMinutes: 3,
    paragraphs: [
      "Wages have a fundamental problem: you have to keep showing up. The salary stops the day you stop. There's no compounding, no asymmetric upside, no scenario where one good year sets you up for ten.",
      "Equity is different. Owning a piece of something — a business, a property, a body of work — pays you whether you're working or not. It compounds. It scales. The same hour of your time, applied to something you own, can pay forever instead of once.",
      "This isn't an argument that wages are bad. Wages fund early life, build skills, fund the buffer that lets you take risks. But every successful path to durable wealth eventually shifts toward ownership: of a business, a portfolio, intellectual property, a brand, real estate.",
      "The shift doesn't have to be dramatic. Saving and investing is a small version of it — you're trading wage income for equity income, slowly. The earlier you start treating ownership as the goal and wages as the fuel, the faster the engine catches.",
    ],
  },
  {
    slug: "skill-stacking",
    pillar: "leverage",
    title: "Skill stacking",
    hook: "You don't have to be the best at one thing. You can be the only one at the intersection.",
    estMinutes: 3,
    paragraphs: [
      "Being the best in the world at one thing is almost impossible. Being the best in your field at one thing is rare. Being good — top 25% — at three unrelated things is achievable, and it can be more valuable than mastery of one.",
      "The reason is intersection. Top 25% in writing isn't special. Top 25% in writing plus top 25% in finance plus top 25% in design — that's a tiny number of people. If your work sits at that intersection, you compete with almost no one.",
      "Skill stacks compound the way investments do, slowly at first and then surprisingly. Each new skill multiplies the value of the others rather than adding to them. A sales-and-engineering combination is worth more than either skill alone, by a lot.",
      "The practical move is to stop optimising for being world-class at one thing and start collecting useful, second-tier skills that nobody else has bothered to combine. The combinations are where the leverage lives.",
    ],
    exercise:
      "What two skills do you have that almost no one in your field has both of?",
  },
];

// ---------------------------------------------------------------------------
// Pillar 5 — Behavior
// ---------------------------------------------------------------------------

const BEHAVIOR: Lesson[] = [
  {
    slug: "boring-wins",
    pillar: "behavior",
    title: "Boring wins",
    hook: "The unsexy strategy you stick with beats the brilliant one you don't.",
    estMinutes: 3,
    speaksTo: ["making_mistake", "missing_opportunities"],
    paragraphs: [
      "Most of what people read about investing is entertainment. The exotic strategies, the contrarian calls, the picks that 10x — these make for good content. They don't make for good outcomes.",
      "The actual record of long-term wealth is almost embarrassingly boring. Save a meaningful fraction of income. Put it into broad, low-cost, diversified investments. Don't sell during downturns. Wait three decades. Do almost nothing else.",
      "This works partly because the math compounds and partly because almost no one can stick to it. The boring strategy is hard not because the steps are difficult but because the temptation to do something else is constant. Every market move, every news cycle, every friend with a hot tip is a chance to abandon the plan.",
      "The edge isn't intelligence. It's the boredom tolerance to keep doing the same right thing for thirty years while everything around you suggests you should do something more interesting.",
    ],
  },
  {
    slug: "history-of-drawdowns",
    pillar: "behavior",
    title: "History of drawdowns",
    hook: "Markets fall 30% roughly every decade. They have always recovered.",
    estMinutes: 4,
    speaksTo: ["market_crash"],
    paragraphs: [
      "If you own broad investments long enough, you will live through several large declines. This isn't a possibility — it's the historical norm. The S&P 500 has dropped 30% or more about once a decade since records began. Each time felt like the end. Each time recovered.",
      "Recent examples: 2000 (-49%, recovered by 2007), 2008 (-57%, recovered by 2013), 2020 (-34%, recovered in months), 2022 (-25%, recovered by 2024). And further back: 1973, 1987, 1990, 1998. The pattern is so consistent it's almost reassuring.",
      "What hurts most people isn't the drawdown — it's the response. Selling near the bottom locks in the loss. Staying out during the recovery means missing the gains. Most of the long-term return of stock markets comes in short, unpredictable bursts following declines. Investors who panic out miss them.",
      "The defence isn't prediction. It's pre-commitment. Decide now what you will do during the next big drop. Write it down. The decision made in calm conditions is the only one that survives the panic.",
    ],
    exercise:
      "If your portfolio dropped 35% next month, what would you do? Write the answer down before you need it.",
  },
  {
    slug: "fomo-is-a-tax",
    pillar: "behavior",
    title: "FOMO is a tax",
    hook: "Every move you make to chase what's already happened costs more than it earns.",
    estMinutes: 3,
    speaksTo: ["missing_opportunities", "making_mistake"],
    paragraphs: [
      "By the time something is obvious enough to feel like a missed opportunity, it's usually too late to be a good one. The price already reflects the story everyone is telling.",
      "Fear of missing out drives most retail investing mistakes. The asset triples, the news catches on, the friend brags at dinner — and the late buyer enters at the top of a cycle that's about to mean-revert. Then sells at the bottom when reality returns.",
      "The pattern is consistent across asset classes and decades. Every bubble has a moment when ordinary people pile in because they can't bear to keep watching. Every bubble ends with those same people losing more than they would have made by simply ignoring it.",
      "The cure is to design your finances so that FOMO doesn't trigger action. Pre-commit to a simple, diversified strategy. Define what you'd buy and why before you hear about it. When the urge to chase appears, treat it as a signal that you're near the wrong moment.",
    ],
  },
  {
    slug: "decision-vs-outcome",
    pillar: "behavior",
    title: "Decision vs outcome",
    hook: "A good decision can have a bad outcome. A bad decision can get lucky. Judge the process.",
    estMinutes: 3,
    paragraphs: [
      "It's tempting to evaluate financial decisions by their results. The investment that 10x'd was a good decision; the one that lost half was a bad one. This logic is wrong, and it's expensive.",
      "Decisions and outcomes are separate. A good decision is one that, given the information you had, was the right move on average. A good outcome is one that, in the specific path that played out, worked. The two can come apart in any direction. Brilliant decisions sometimes lose. Reckless decisions sometimes win.",
      "Judging yourself by outcomes leads to two mistakes. You'll abandon good processes after one bad result. And you'll double down on bad processes that happened to work. Both end badly over a lifetime.",
      "The discipline is to evaluate the decision: did you have a clear thesis, sized appropriately, with downside understood? If yes, the result is noise. If no, the result is luck. Either way, the next decision needs the same scrutiny — independent of how the last one went.",
    ],
  },
  {
    slug: "the-quiet-portfolio",
    pillar: "behavior",
    title: "The quiet portfolio",
    hook: "Watch less. Adjust less. Almost always do better.",
    estMinutes: 3,
    paragraphs: [
      "There's a counterintuitive finding from decades of investor data: the people who do best are the ones who pay the least attention. Not because they're smarter, but because they don't get to talk themselves out of their own plan.",
      "Frequent checking creates frequent reactions. The portfolio drops 5% — a small number historically — and the urge to do something arises. The 'something' is almost always wrong. Selling, switching, rebalancing in panic. Each move costs in fees, taxes, and timing errors.",
      "A quiet portfolio is the opposite. Set up a sensible allocation. Automate the contributions. Look at it once a quarter, or once a year, with the explicit goal of not changing anything unless something has fundamentally shifted in your life — not the market.",
      "This sounds passive because it is. Passive is the point. The market provides the returns; you provide the patience. Patience compounds. Activity, in this domain, almost always subtracts.",
    ],
    exercise:
      "When did you last check your investments? What did you change as a result? Was the change worth it?",
  },
];

// ---------------------------------------------------------------------------
// Public catalog
// ---------------------------------------------------------------------------

export const LESSON_CATALOG: readonly Lesson[] = [
  ...SURVIVAL,
  ...ENOUGH,
  ...TIME,
  ...LEVERAGE,
  ...BEHAVIOR,
] as const;

const BY_SLUG = new Map<string, Lesson>(
  LESSON_CATALOG.map((l) => [l.slug, l]),
);

export function getLesson(slug: string): Lesson | undefined {
  return BY_SLUG.get(slug);
}

export function lessonsByPillar(pillar: Lesson["pillar"]): Lesson[] {
  return LESSON_CATALOG.filter((l) => l.pillar === pillar);
}
