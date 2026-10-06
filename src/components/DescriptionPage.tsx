import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Calculator,
  CalendarClock,
  ClipboardList,
  Download,
  Droplet,
  Flame,
  Gauge,
  Info,
  Lock,
  MessagesSquare,
  Scale,
  ShieldCheck,
  Users,
  ChevronDown,
  Sparkles,
  Smartphone
} from 'lucide-react';

interface DescriptionPageProps {
  onOpenApp: (initialAction?: 'guest' | 'login' | 'program' | 'demo', programSlug?: string) => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenCookies?: () => void;
  onOpenFaq?: () => void;
  onOpenContact?: () => void;
  onOpenPress?: () => void;
}

const STEPS = [
  {
    icon: ClipboardList,
    title: 'Baseline',
    body: 'Height, weight, age and activity go in once. We calculate your resting rate and maintenance intake from those numbers alone.'
  },
  {
    icon: Gauge,
    title: 'Targets',
    body: 'Your calorie and macronutrient targets are set to your goal — loss, maintenance or gain — and loaded into the diary the same minute.'
  },
  {
    icon: CalendarClock,
    title: 'Check',
    body: 'You log; the app measures. Once a week you compare intake with the target and see the direction of the trend, so any adjustment is yours and made on evidence.'
  }
];

const CATALOG = [
  {
    slug: 'foundations-8',
    name: 'Foundations',
    tagline: 'Eight weeks of measured fat loss',
    description:
      'The core ForkCount program for losing weight without guessing. You set your targets from your own measurements, log against them, and the weekly report shows whether the plan is working. Nothing is banned, and nothing is promised that your own data cannot show.',
    category: 'program',
    goal: 'lose',
    durationWeeks: 8,
    includes: [
      'Calorie and macro targets calculated from your own stats',
      'Weekly review prompts built from your own diary',
      'Access to the seasonal meal library',
      'Progress reporting against your goal'
    ],
    badge: 'Most chosen',
    featured: true
  },
  {
    slug: 'reset-4',
    name: 'Reset',
    tagline: 'Four weeks to establish the habit',
    description:
      'A short, deliberate introduction for anyone who has never tracked before. Four weeks of structure: learn to log accurately, understand portions, and finish with a clear picture of your maintenance needs.',
    category: 'program',
    goal: 'lose',
    durationWeeks: 4,
    includes: [
      'Baseline calorie and protein targets',
      'Guided two-week logging setup',
      'Habit checklist and weekly prompts'
    ],
    badge: 'Start here'
  },
  {
    slug: 'continuum-12',
    name: 'Continuum',
    tagline: 'Twelve weeks of maintenance, held steady',
    description:
      'The hardest part of weight management is the part after the weight comes off. Continuum holds your maintenance range, surfaces drift early in the trend, and helps you adjust your targets as your body settles.',
    category: 'program',
    goal: 'maintain',
    durationWeeks: 12,
    includes: [
      'Maintenance range calibrated to your logged intake',
      'Weekly trend checks and early drift alerts',
      'Weight trend monitoring with your own notes',
      'Macro targets that follow your plan'
    ]
  },
  {
    slug: 'structure-12',
    name: 'Structure',
    tagline: 'Twelve weeks of controlled weight gain',
    description:
      'A measured surplus for anyone building lean mass. Your rate of gain is capped, your protein floor is fixed, and every week you can check that the weight you are adding is the weight you wanted to add.',
    category: 'program',
    goal: 'gain',
    durationWeeks: 12,
    includes: [
      'Capped rate of gain with a protein floor',
      'Training-day and rest-day nutrition templates',
      'Weekly intake reporting for a steady surplus'
    ]
  },
  {
    slug: 'meal-library',
    name: 'Seasonal Meal Library',
    tagline: 'Twelve weeks of menus, already costed',
    description:
      'Twelve weeks of chef-written menus with macronutrients calculated and shopping lists organised by aisle. Built to sit inside your targets rather than replace them.',
    category: 'guide',
    goal: 'lose',
    durationWeeks: null,
    includes: [
      '84 meals with full macronutrient data',
      'Weekly shopping lists, organised by aisle',
      'Vegetarian and dairy-free variations'
    ]
  },
  {
    slug: 'portion-guide',
    name: 'Portions and Labels',
    tagline: 'Reading a packet properly, in one page',
    description:
      'How to turn what is printed on a packet into a diary entry: serving sizes versus the whole pack, per-100 g columns, and the handful of measures worth memorising.',
    category: 'guide',
    goal: 'any',
    durationWeeks: null,
    includes: [
      'Per-serving and per-100 g worked examples',
      'Cup and spoon measures, metric and imperial',
      'A short list of common portion mistakes'
    ]
  }
];

const CAPABILITIES = [
  {
    icon: Flame,
    title: 'A diary that respects your time',
    body: 'Calorie ring, macronutrients, meals and water on one screen. Logging breakfast should take fifteen seconds, not three minutes.'
  },
  {
    icon: BarChart3,
    title: 'Reporting you can act on',
    body: 'Seven days of intake against your goal, weekly averages, and a weight trend that separates noise from progress.'
  },
  {
    icon: MessagesSquare,
    title: 'Chat with the developer',
    body: 'Suggestions, bugs and requests go straight to the person who builds ForkCount, not into a support queue.'
  },
  {
    icon: Users,
    title: 'Members who are doing the same',
    body: 'Track your meals, build your own recipe templates, and compare notes with evidence-based nutrition principles.'
  },
  {
    icon: Scale,
    title: 'Weight and trend, tracked',
    body: 'Daily weigh-ins become a line you can read, so a bad morning is easy to tell apart from a bad month.'
  },
  {
    icon: Calculator,
    title: 'Self-guided — the maths is done for you',
    body: 'Nothing is prescribed and nothing is guessed. Your resting rate, daily target and macros come from your own stats, and you can change any of them whenever your circumstances do.'
  }
];

const STANDARDS = [
  {
    icon: ShieldCheck,
    title: 'No claims we cannot show you',
    body: 'ForkCount is a tracking tool. We do not diagnose, treat or promise an outcome, and we do not describe anything in the app as clinical.'
  },
  {
    icon: Info,
    title: 'Honest about our limits',
    body: 'We count calories and macros; we are not a medical service. Where your needs are medical, we say so and send you to your doctor.'
  },
  {
    icon: Download,
    title: 'Your data, exportable',
    body: 'Your diary, weigh-ins and programs belong to you. Export them at any time or close your account entirely.'
  },
  {
    icon: Lock,
    title: 'Private by default',
    body: 'Your diary and weigh-ins are visible only to you. We store data securely with row-level protection.'
  }
];

const FAQ = [
  {
    question: 'What does it cost?',
    answer:
      'Nothing. The diary, calorie ring, macronutrients, water tracking, weekly reporting, the BMR calculator and the community are free, and every program and guide in the catalog is free too. There is no card to enter and nothing that renews.'
  },
  {
    question: 'Is ForkCount medical treatment?',
    answer:
      'It is not. ForkCount is a calorie and macronutrient tracker with a target calculated from your own body. It does not diagnose or treat anything, and it is not a substitute for advice from your doctor.'
  },
  {
    question: 'Who sets my targets?',
    answer:
      'You do, with the arithmetic done for you. We estimate your resting rate from your height, weight, age and sex, apply your activity level and goal, and you can override any number whenever your circumstances change.'
  },
  {
    question: 'Where do I get help?',
    answer:
      'Message the developer directly from the Me tab. Bugs, missing foods and feature requests all go to the same place, and replies are written by hand. Anything medical belongs with your doctor.'
  }
];

export function DescriptionPage({
  onOpenApp,
  onOpenPrivacy,
  onOpenTerms,
  onOpenCookies,
  onOpenFaq,
  onOpenContact,
  onOpenPress
}: DescriptionPageProps) {
  const [selectedGoal, setSelectedGoal] = useState<string>('all');
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [isLoadingDemo, setIsLoadingDemo] = useState<boolean>(false);

  const filteredCatalog = CATALOG.filter((item) => {
    if (selectedGoal === 'all') return true;
    if (selectedGoal === 'guide') return item.category === 'guide';
    return item.goal === selectedGoal;
  });

  const toggleFaq = (question: string) => {
    setOpenFaq(openFaq === question ? null : question);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--chart-1)]/20 selection:text-[var(--chart-1)]">
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      {/* Radial ambient background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[560px]"
        style={{
          background:
            'radial-gradient(85% 65% at 50% 0%, color-mix(in oklab, var(--chart-1) 14%, transparent) 0%, transparent 72%)'
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* Navigation Header */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-full border border-teal-500/30 bg-teal-500/10 text-[12px] font-semibold text-teal-400">
              F
            </span>
            <span className="font-display text-xl font-semibold tracking-tight text-zinc-100">
              ForkCount
            </span>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#method" className="transition-colors hover:text-zinc-100">
              The method
            </a>
            <a href="#programs" className="transition-colors hover:text-zinc-100">
              Programs
            </a>
            <a href="#standards" className="transition-colors hover:text-zinc-100">
              Standards
            </a>
            <a href="#questions" className="transition-colors hover:text-zinc-100">
              Questions
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenApp('login')}
              className="rounded-xl px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
            >
              Member sign in
            </button>
            <button
              onClick={() => onOpenApp('guest')}
              className="flex items-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-md shadow-teal-500/20 transition-all hover:bg-teal-400 active:scale-95"
            >
              <span>Get started</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section id="main-content" className="grid items-center gap-12 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <span className="eyebrow">
              <span className="size-1.5 rounded-full bg-teal-400" />
              Calorie and macro tracking
            </span>

            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-[3.5rem] tracking-tight">
              Weight management, properly measured.
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-zinc-300">
              Precise calorie and macro tracking, calculated from your own body. Lose, maintain or gain weight on targets you can check yourself — then watch the trend hold, week after week, over numbers rather than a stranger&apos;s guess.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenApp('guest')}
                className="flex h-12 items-center gap-2 rounded-xl bg-teal-500 px-6 font-medium text-zinc-950 shadow-lg shadow-teal-500/25 transition-all hover:bg-teal-400 active:scale-95"
              >
                <span>Get started</span>
                <ArrowRight className="size-4" />
              </button>

              <button
                type="button"
                disabled={isLoadingDemo}
                onClick={() => {
                  setIsLoadingDemo(true);
                  onOpenApp('demo');
                }}
                aria-label="Try interactive demo with 7 days of sample data"
                className="flex h-12 items-center gap-2 rounded-xl border border-teal-500/40 bg-teal-500/10 px-5 text-sm font-semibold text-teal-300 transition-colors hover:bg-teal-500/20"
              >
                <span>{isLoadingDemo ? 'Loading demo...' : 'Try Demo (7 days sample data)'}</span>
              </button>

              <a
                href="#programs"
                className="flex h-12 items-center rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800/80"
              >
                Browse the programs
              </a>
            </div>

            <div className="mt-8 grid gap-2.5 text-xs text-zinc-300">
              <span className="flex items-center gap-2">
                <Calculator className="size-3.5 text-teal-400" />
                Self-guided — you set your targets, the app does the maths.
              </span>
              <span className="flex items-center gap-2">
                <Lock className="size-3.5 text-teal-400" />
                Everything is free. No card, no trial, nothing that renews.
              </span>
              <span className="flex items-center gap-2 text-teal-300 font-medium">
                <ShieldCheck className="size-3.5 text-teal-400" />
                Built by someone who lost 8 kg using this exact system.
              </span>
            </div>
          </div>

          {/* Hero Right: Interactive Live Preview Card */}
          <div className="relative">
            <div className="surface relative overflow-hidden p-6 sm:p-7">
              {/* Header preview row */}
              <div className="flex items-center justify-between border-b border-zinc-800/70 pb-4">
                <div>
                  <span className="eyebrow">
                    <span className="size-1.5 rounded-full bg-teal-400 animate-pulse" />
                    Today&apos;s diary
                  </span>
                  <p className="font-display text-sm font-semibold text-zinc-200 mt-0.5">
                    Wednesday · On target
                  </p>
                </div>
                <button
                  onClick={() => onOpenApp('guest')}
                  className="flex items-center gap-1 rounded-lg border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-medium text-teal-300 transition-colors hover:bg-teal-500/20"
                >
                  <Smartphone className="size-3" />
                  <span>Open tracker</span>
                </button>
              </div>

              {/* Calorie Ring display */}
              <div className="my-6 flex flex-col items-center justify-center">
                <div className="relative flex items-center justify-center">
                  <svg width="190" height="190" viewBox="0 0 190 190" className="-rotate-90">
                    <defs>
                      <linearGradient id="ring-gradient-preview" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#14b8a6" />
                        <stop offset="100%" stopColor="#2dd4bf" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="95"
                      cy="95"
                      r="80"
                      fill="none"
                      stroke="#27272a"
                      strokeWidth="12"
                      opacity="0.6"
                    />
                    <circle
                      cx="95"
                      cy="95"
                      r="80"
                      fill="none"
                      stroke="url(#ring-gradient-preview)"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 80}
                      strokeDashoffset={2 * Math.PI * 80 * (1 - 1310 / 2140)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="label-caps">remaining</span>
                    <span className="num mt-0.5 text-3xl font-semibold leading-none text-zinc-100">
                      830
                    </span>
                    <span className="text-[11px] text-zinc-500 mt-1">kcal left</span>
                  </div>
                </div>

                <p className="mt-3 text-xs text-zinc-400">
                  Target <span className="text-zinc-200 font-medium">2,140</span> − Eaten <span className="text-zinc-200 font-medium">1,310</span> kcal
                </p>
              </div>

              {/* Macro Bars */}
              <div className="grid gap-3 border-t border-zinc-800/70 pt-4">
                {/* Protein */}
                <div className="grid gap-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-zinc-400">Protein</span>
                    <span className="num font-medium text-zinc-200">
                      96 <span className="text-zinc-500">/ 161 g</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${(96 / 161) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Carbs */}
                <div className="grid gap-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-zinc-400">Carbohydrates</span>
                    <span className="num font-medium text-zinc-200">
                      128 <span className="text-zinc-500">/ 214 g</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-sky-500"
                      style={{ width: `${(128 / 214) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Fat */}
                <div className="grid gap-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-zinc-400">Fat</span>
                    <span className="num font-medium text-zinc-200">
                      44 <span className="text-zinc-500">/ 71 g</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${(44 / 71) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Meal log rows */}
              <div className="mt-4 grid gap-2">
                {[
                  { name: 'Rolled oats with milk & blueberries', meal: 'Breakfast', kcal: '380 kcal' },
                  { name: 'Sourdough toast with poached eggs', meal: 'Lunch', kcal: '420 kcal' },
                  { name: 'Greek yogurt & clover honey', meal: 'Snack', kcal: '210 kcal' }
                ].map((row) => (
                  <div
                    key={row.name}
                    className="surface-flat flex items-center justify-between px-3.5 py-2 text-xs"
                  >
                    <div>
                      <p className="font-medium text-zinc-200">{row.name}</p>
                      <p className="text-[10px] text-zinc-500">{row.meal}</p>
                    </div>
                    <span className="num font-medium text-zinc-300">{row.kcal}</span>
                  </div>
                ))}
              </div>

              {/* Water glasses */}
              <div className="mt-4 flex items-center justify-between border-t border-zinc-800/70 pt-4">
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <Droplet className="size-3.5 text-teal-400" />
                  <span>Water tracker</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 8 }, (_, idx) => (
                    <span
                      key={idx}
                      className={`size-4 rounded-[4px] border ${
                        idx < 5
                          ? 'border-teal-400/50 bg-teal-400/25'
                          : 'border-zinc-700/80 bg-zinc-800/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Insight card */}
            <div className="surface mt-4 flex items-center gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
                <MessagesSquare className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-200">Your week in numbers</p>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Protein is 14 g short across the week. Pull it into breakfast rather than dinner, then check the chart again on Sunday.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: The Method */}
        <section id="method" className="border-t border-zinc-800/70 py-16">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <span className="eyebrow">The method</span>
              <h2 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl text-zinc-100">
                Three steps, repeated with discipline
              </h2>
              <p className="mt-5 text-sm leading-relaxed text-zinc-400">
                No detoxes, no meal replacements, no claims we cannot show you in a chart. Measurement, adjustment, checking — the part that actually holds over a year.
              </p>
            </div>

            <ol className="grid gap-4 sm:grid-cols-3">
              {STEPS.map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <li key={step.title} className="surface grid gap-3 p-5">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
                      <IconComponent className="size-4" />
                    </span>
                    <span className="font-display text-base font-semibold text-zinc-200">
                      {index + 1}. {step.title}
                    </span>
                    <span className="text-[13px] leading-relaxed text-zinc-400">
                      {step.body}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Section: Programs */}
        <section id="programs" className="border-t border-zinc-800/70 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow">Programs</span>
              <h2 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl text-zinc-100">
                Choose the direction you need
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-zinc-400">
                Structure for whichever way you are going, with your targets calculated from your own stats. All of it free.
              </p>
            </div>

            {/* Goal filter tabs */}
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1 text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'lose', label: 'Weight loss' },
                { id: 'maintain', label: 'Maintenance' },
                { id: 'gain', label: 'Weight gain' },
                { id: 'guide', label: 'Guides' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedGoal(tab.id)}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    selectedGoal === tab.id
                      ? 'bg-zinc-800 text-teal-300'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCatalog.map((program) => (
              <div
                key={program.slug}
                className="surface flex flex-col p-6 transition-all hover:border-zinc-600/70"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="label-caps text-teal-400/90">
                    {program.category === 'guide'
                      ? 'Guide'
                      : program.goal === 'lose'
                      ? 'Weight loss'
                      : program.goal === 'maintain'
                      ? 'Maintenance'
                      : 'Weight gain'}
                  </span>
                  {program.badge && (
                    <span className="rounded-full border border-teal-500/40 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-teal-300">
                      {program.badge}
                    </span>
                  )}
                </div>

                <div className="mt-3 grid gap-1.5">
                  <h3 className="font-display text-2xl font-semibold text-zinc-100">
                    {program.name}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-zinc-400">
                    {program.tagline}
                  </p>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                  {program.description}
                </p>

                <div className="my-4 grid gap-1.5 border-t border-zinc-800/70 pt-3">
                  {program.includes.slice(0, 3).map((item, idx) => (
                    <p key={idx} className="flex items-start gap-1.5 text-[11px] text-zinc-400">
                      <span className="mt-1 size-1 rounded-full bg-teal-400 shrink-0" />
                      <span>{item}</span>
                    </p>
                  ))}
                </div>

                <div className="mt-auto grid gap-3 border-t border-zinc-800/70 pt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="num font-display text-xl font-semibold text-zinc-100">
                      Free
                    </span>
                    {program.durationWeeks && (
                      <span className="text-[11px] text-zinc-500">
                        · {program.durationWeeks} weeks
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onOpenApp('program', program.slug)}
                    className="flex h-10 items-center justify-center rounded-xl bg-teal-500 px-4 text-xs font-semibold text-zinc-950 transition-colors hover:bg-teal-400 active:scale-95"
                  >
                    Start this program
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section: In Your Account (Capabilities) */}
        <section className="border-t border-zinc-800/70 py-16">
          <div className="max-w-2xl">
            <span className="eyebrow">In your account</span>
            <h2 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl text-zinc-100">
              Everything the week requires
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-zinc-400">
              Diary, reporting, developer chat and community sit behind one sign-in, on the phone you already carry.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => {
              const IconComponent = item.icon;
              return (
                <div key={item.title} className="surface p-5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-800/80 text-zinc-200">
                    <IconComponent className="size-4 text-teal-400" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold text-zinc-200">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section: Standards */}
        <section id="standards" className="border-t border-zinc-800/70 py-16">
          <div className="surface grid gap-8 p-8 lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
            <div>
              <span className="eyebrow">Our standards</span>
              <h2 className="mt-4 font-display text-2xl font-semibold leading-snug sm:text-3xl text-zinc-100">
                Serious about what we claim
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                Weight management attracts exaggeration. These four commitments are how we keep ourselves honest.
              </p>
            </div>

            <ul className="grid gap-5 sm:grid-cols-2">
              {STANDARDS.map((item) => {
                const IconComponent = item.icon;
                return (
                  <li key={item.title} className="grid gap-2">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
                      <IconComponent className="size-4" />
                    </span>
                    <h3 className="font-display text-sm font-semibold text-zinc-200">
                      {item.title}
                    </h3>
                    <p className="text-[12px] leading-relaxed text-zinc-400">
                      {item.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Section: Questions (FAQ) */}
        <section id="questions" className="border-t border-zinc-800/70 py-16">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <span className="eyebrow">Questions</span>
              <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-zinc-100">
                Asked before joining
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                Clear answers about cost, safety, target calculation, and who builds ForkCount.
              </p>
            </div>

            <div className="space-y-3">
              {FAQ.map((item) => {
                const isOpen = openFaq === item.question;
                return (
                  <div
                    key={item.question}
                    className="surface overflow-hidden transition-colors"
                  >
                    <button
                      onClick={() => toggleFaq(item.question)}
                      className="flex w-full items-center justify-between p-5 text-left font-display text-[15px] font-semibold text-zinc-200 hover:text-zinc-100"
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        className={`size-4 text-zinc-400 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-teal-400' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="border-t border-zinc-800/70 px-5 pb-5 pt-3 text-[13px] leading-relaxed text-zinc-400">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Call to action pre-footer */}
        <section className="border-t border-zinc-800/70 py-16 text-center">
          <div className="surface mx-auto max-w-2xl p-8 sm:p-10">
            <span className="eyebrow justify-center">
              <Sparkles className="size-3 text-teal-400" />
              Begin today
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold text-zinc-100">
              Start tracking your week
            </h2>
            <p className="mt-3 text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
              No account required to explore. Launch as a guest or sign in to synchronize across your devices.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => onOpenApp('guest')}
                className="flex h-12 items-center gap-2 rounded-xl bg-teal-500 px-6 font-semibold text-zinc-950 shadow-lg shadow-teal-500/25 transition-all hover:bg-teal-400 active:scale-95"
              >
                <span>Open ForkCount Tracker</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-zinc-800/70 py-8 text-xs text-zinc-400 space-y-3">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-full border border-teal-500/30 bg-teal-500/10 text-[10px] font-semibold text-teal-400">
                F
              </span>
              <span className="text-zinc-300">&copy; {new Date().getFullYear()} ForkCount — calorie and macro tracking.</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-zinc-400">
              <a
                href="/privacy"
                onClick={(e) => {
                  if (onOpenPrivacy) {
                    e.preventDefault();
                    onOpenPrivacy();
                  }
                }}
                className="text-teal-400 underline underline-offset-4 transition-colors hover:text-teal-300"
              >
                Privacy
              </a>
              <span>·</span>
              <a
                href="/terms"
                onClick={(e) => {
                  if (onOpenTerms) {
                    e.preventDefault();
                    onOpenTerms();
                  }
                }}
                className="text-teal-400 underline underline-offset-4 transition-colors hover:text-teal-300"
              >
                Terms
              </a>
              <span>·</span>
              <a
                href="/cookies"
                onClick={(e) => {
                  if (onOpenCookies) {
                    e.preventDefault();
                    onOpenCookies();
                  }
                }}
                className="text-teal-400 underline underline-offset-4 transition-colors hover:text-teal-300"
              >
                Cookies
              </a>
              <span>·</span>
              <a
                href="/faq"
                onClick={(e) => {
                  if (onOpenFaq) {
                    e.preventDefault();
                    onOpenFaq();
                  }
                }}
                className="text-teal-400 underline underline-offset-4 transition-colors hover:text-teal-300"
              >
                FAQ
              </a>
              <span>·</span>
              <a
                href="/press"
                onClick={(e) => {
                  if (onOpenPress) {
                    e.preventDefault();
                    onOpenPress();
                  }
                }}
                className="text-teal-400 underline underline-offset-4 transition-colors hover:text-teal-300"
              >
                Press
              </a>
              <span>·</span>
              <a
                href="/contact"
                onClick={(e) => {
                  if (onOpenContact) {
                    e.preventDefault();
                    onOpenContact();
                  }
                }}
                className="text-teal-400 underline underline-offset-4 transition-colors hover:text-teal-300"
              >
                Contact
              </a>
            </div>
          </div>

          <div className="space-y-1.5 text-zinc-400">
            <p className="leading-relaxed">
              ForkCount provides weight-management tracking tools and is not a medical provider. Speak to your doctor before changing how you eat or train.
            </p>
            <p className="leading-relaxed">
              If you&apos;re under 18, use ForkCount with a parent or guardian.
            </p>
            <p className="leading-relaxed">
              ForkCount uses local storage to keep you signed in and remember your theme. It does not use tracking cookies. See our{' '}
              <a
                href="/privacy"
                onClick={(e) => {
                  if (onOpenPrivacy) {
                    e.preventDefault();
                    onOpenPrivacy();
                  }
                }}
                className="text-teal-400 underline underline-offset-4 transition-colors hover:text-teal-300"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
