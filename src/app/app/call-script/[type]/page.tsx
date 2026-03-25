const SCRIPTS: Record<string, { title: string; lines: string[] }> = {
  acquisitions: {
    title: "Acquisitions Call Script",
    lines: [
      "Hi, this is [Your Name] with BT Investments. Am I speaking with [Lead Name]?",
      "Great! I'm reaching out because we understand you may be interested in selling your property at [Address]. Is that correct?",
      "Wonderful. Can you tell me a little about the property and your situation?",
      "What's your ideal timeline for selling?",
      "Have you had the property appraised or do you have a price in mind?",
      "Is the property currently occupied?",
      "What would you say is the overall condition of the property?",
      "Perfect. Based on what you've shared, we'd love to take a closer look and put together an offer for you. Would that work?",
      "Great, I'll get that process started. Is this the best number to reach you at going forward?",
      "Thank you for your time, [Lead Name]. We'll be in touch soon!",
    ],
  },
  dispositions: {
    title: "Dispositions Call Script",
    lines: [
      "Hi, this is [Your Name] with BT Investments. Am I speaking with [Investor Name]?",
      "Great! I'm reaching out because we have a property that may fit your investment criteria.",
      "The property is located at [Address]. It's a [Property Type] with [Details].",
      "Based on your interest in [Location/Type], I thought this could be a great fit.",
      "The asking price is [Price]. Are you interested in learning more?",
      "Would you like to schedule a walkthrough or receive the full property packet?",
      "What's your typical timeline for closing on a deal?",
      "Perfect. I'll send over the details. What's the best email to reach you?",
      "Thank you for your time. I'll follow up shortly with more information!",
    ],
  },
  agent_outreach: {
    title: "Agent Outreach Call Script",
    lines: [
      "Hi, this is [Your Name] with BT Investments. Am I speaking with [Agent Name]?",
      "Great! I'm reaching out because we're an active investment group in [Market Area] and we're always looking to work with great agents.",
      "We buy properties regularly and we'd love to be on your radar for any off-market deals or motivated sellers.",
      "What areas do you primarily work in?",
      "Do you come across any distressed properties, pre-foreclosures, or sellers looking for a quick close?",
      "We can typically close within [Timeframe] and we're very flexible on terms.",
      "Would you be open to sending us deals as they come up? We can make it worth your while.",
      "Perfect. What's the best way to send you our criteria so you know exactly what we're looking for?",
      "Thank you for your time, [Agent Name]. Looking forward to working together!",
    ],
  },
  investor_outreach: {
    title: "Investor Outreach Call Script",
    lines: [
      "Hi, this is [Your Name] with BT Investments. Am I speaking with [Investor Name]?",
      "Great! I'm reaching out because we source off-market investment properties and we're building our buyers list.",
      "We specialize in [Property Types] in the [Market Area] area.",
      "Are you currently looking to add properties to your portfolio?",
      "What types of properties are you most interested in? Single-family, multi-family, commercial?",
      "What areas or markets are you focused on?",
      "What's your typical budget range for acquisitions?",
      "Do you prefer turnkey properties or are you open to value-add opportunities?",
      "Perfect. I'd love to add you to our list and send you deals as they come in. What's the best email for property details?",
      "Thank you for your time, [Investor Name]. We'll be in touch with opportunities soon!",
    ],
  },
};

export default async function CallScriptPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const script = SCRIPTS[type];

  if (!script) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-neutral-500">Script not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">
        {script.title}
      </h1>
      <ol className="space-y-5">
        {script.lines.map((line, i) => (
          <li key={i} className="flex gap-4">
            <span className="shrink-0 text-sm text-neutral-400 font-mono mt-0.5 w-6 text-right">
              {i + 1}.
            </span>
            <span className="text-neutral-700 font-editable leading-relaxed">
              {line}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
