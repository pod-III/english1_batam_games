const TENSES = {
    // PRESENT GROUP
    presentSimple: {
        cat: 'Present', color: 'green',
        title: "Simple Present",
        formulaParts: [
            { text: "S", tip: "Subject (I, You, He, She, It, We, They)" },
            { text: "+", tip: "" },
            { text: "V1", tip: "Base form of the verb (play, eat)" },
            { text: "(s/es)", tip: "Add s/es for He/She/It (plays, eats)" }
        ],
        desc: "Used for facts, habits, and routines that are generally true.",
        usage: ["Habits & Routines", "General Facts/Truths", "Scheduled Events"],
        signals: ["Every day", "Always", "Often", "Usually"],
        example: "I play tennis every Sunday.",
        viz: [{ type: 'pin', l: 15, label: 'Action', y: 50 }, { type: 'pin', l: 35, label: 'Action', y: 50 }, { type: 'pin', l: 50, label: 'Action', y: 50 }, { type: 'pin', l: 65, label: 'Action', y: 50 }, { type: 'pin', l: 85, label: 'Action', y: 50 }, { type: 'range', l: 10, w: 80, label: 'Routine / Always True', y: 68 }]
    },
    presentCont: {
        cat: 'Present', color: 'green',
        title: "Present Continuous",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "am/is/are", tip: "To be verb" },
            { text: "+", tip: "" },
            { text: "V-ing", tip: "Present Participle (playing, eating)" }
        ],
        desc: "Actions happening exactly right now or temporary situations.",
        usage: ["Actions happening NOW", "Temporary situations", "Future plans"],
        signals: ["Now", "At the moment", "Look!", "Listen!"],
        example: "I am studying right now.",
        viz: [{ type: 'range', l: 42, w: 16, label: 'Happening Now', y: 50, active: true }]
    },
    presentPerfect: {
        cat: 'Present', color: 'green',
        title: "Present Perfect",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "have/has", tip: "Auxiliary verb" },
            { text: "+", tip: "" },
            { text: "V3", tip: "Past Participle (played, eaten)" }
        ],
        desc: "Actions in the past with a result in the present.",
        usage: ["Past action, Present result", "Life Experiences", "Started past, continues now"],
        signals: ["Just", "Already", "Yet", "Since", "For"],
        example: "I have finished my homework.",
        viz: [{ type: 'pin', l: 30, label: 'Action Done', y: 45 }, { type: 'arrow', l: 30, w: 20, label: 'Result affects NOW', y: 65 }]
    },
    presentPerfectCont: {
        cat: 'Present', color: 'green',
        title: "Present Perf. Cont.",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "have/has", tip: "Auxiliary verb" },
            { text: "+", tip: "" },
            { text: "been", tip: "Past participle of 'be'" },
            { text: "+", tip: "" },
            { text: "V-ing", tip: "Present Participle (playing)" }
        ],
        desc: "Actions that started in the past and are still continuing now.",
        usage: ["Duration of present activity", "Action just stopped"],
        signals: ["For 2 hours", "Since morning", "All day"],
        example: "I have been waiting for 2 hours.",
        viz: [{ type: 'range', l: 20, w: 30, label: 'Started Past', y: 45 }, { type: 'arrow', l: 20, w: 30, label: 'Duration leading to NOW', y: 65 }]
    },

    // PAST GROUP
    pastSimple: {
        cat: 'Past', color: 'pink',
        title: "Simple Past",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "V2", tip: "Past form of the verb (played, ate)" }
        ],
        desc: "Actions completed at a specific time in the past.",
        usage: ["Completed action in past", "Series of past actions", "Past habits/facts"],
        signals: ["Yesterday", "Last week", "In 2010", "Ago"],
        example: "I visited Batam yesterday.",
        viz: [{ type: 'pin', l: 25, label: 'Action Happened', y: 40 }, { type: 'marker', l: 25, label: 'Specific Time', y: 75 }]
    },
    pastCont: {
        cat: 'Past', color: 'pink',
        title: "Past Continuous",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "was/were", tip: "Past tense 'to be'" },
            { text: "+", tip: "" },
            { text: "V-ing", tip: "Present Participle" }
        ],
        desc: "Actions that were in progress at a specific moment in the past.",
        usage: ["Action in progress in past", "Interrupted action", "Parallel actions"],
        signals: ["When", "While", "At 8 PM last night"],
        example: "I was sleeping when you called.",
        viz: [{ type: 'range', l: 15, w: 20, label: 'Was Doing...', y: 55 }, { type: 'pin', l: 25, label: 'Interruption', y: 30 }]
    },
    pastPerfect: {
        cat: 'Past', color: 'pink',
        title: "Past Perfect",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "had", tip: "Past auxiliary" },
            { text: "+", tip: "" },
            { text: "V3", tip: "Past Participle" }
        ],
        desc: "An action that happened before another action in the past.",
        usage: ["Action before another past action", "Reported speech"],
        signals: ["Before", "After", "By the time"],
        example: "She had left before I arrived.",
        viz: [{ type: 'pin', l: 15, label: 'Event 1 (Had done)', y: 45 }, { type: 'pin', l: 35, label: 'Event 2', y: 45 }, { type: 'arrow', l: 15, w: 20, label: 'Before', y: 65 }]
    },
    pastPerfectCont: {
        cat: 'Past', color: 'pink',
        title: "Past Perf. Cont.",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "had", tip: "Past auxiliary" },
            { text: "+", tip: "" },
            { text: "been", tip: "Past participle of 'be'" },
            { text: "+", tip: "" },
            { text: "V-ing", tip: "Present Participle" }
        ],
        desc: "Duration of an activity up to a point in the past.",
        usage: ["Duration before past event", "Cause of a past result"],
        signals: ["For", "Since", "Before"],
        example: "I had been running so I was tired.",
        viz: [{ type: 'range', l: 10, w: 25, label: 'Was doing...', y: 50 }, { type: 'pin', l: 35, label: 'Event', y: 50 }]
    },

    // FUTURE GROUP
    futureSimple: {
        cat: 'Future', color: 'blue',
        title: "Simple Future",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "will", tip: "Modal verb for future" },
            { text: "+", tip: "" },
            { text: "V1", tip: "Base verb form" }
        ],
        desc: "Decisions made now, predictions, or promises for the future.",
        usage: ["Spontaneous decision", "Prediction", "Promise/Threat"],
        signals: ["Tomorrow", "Next week", "Soon"],
        example: "I will call you later.",
        viz: [{ type: 'pin', l: 75, label: 'Action Future', y: 50 }, { type: 'arrow', l: 50, w: 25, label: 'Decision Now', y: 65 }]
    },
    futureCont: {
        cat: 'Future', color: 'blue',
        title: "Future Continuous",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "will", tip: "Modal" },
            { text: "+", tip: "" },
            { text: "be", tip: "Base form of 'be'" },
            { text: "+", tip: "" },
            { text: "V-ing", tip: "Present Participle" }
        ],
        desc: "Action that will be in progress at a specific time in the future.",
        usage: ["In progress at future time", "Polite inquiry"],
        signals: ["At 8 PM tomorrow", "This time next week"],
        example: "I will be flying at 8 PM.",
        viz: [{ type: 'range', l: 70, w: 20, label: 'Will be doing...', y: 50 }, { type: 'marker', l: 80, label: 'Specific Time', y: 75 }]
    },
    futurePerfect: {
        cat: 'Future', color: 'blue',
        title: "Future Perfect",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "will have", tip: "Future perfect auxiliary" },
            { text: "+", tip: "" },
            { text: "V3", tip: "Past Participle" }
        ],
        desc: "Action that will be completed before a specific time in the future.",
        usage: ["Completed before future moment"],
        signals: ["By tomorrow", "By the time"],
        example: "I will have finished by 5 PM.",
        viz: [{ type: 'pin', l: 80, label: 'Finished', y: 40 }, { type: 'arrow', l: 50, w: 30, label: 'Done Before', y: 65 }, { type: 'marker', l: 85, label: 'Time Limit', y: 75 }]
    },
    futurePerfectCont: {
        cat: 'Future', color: 'blue',
        title: "Future Perf. Cont.",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "will have", tip: "Auxiliary" },
            { text: "+", tip: "" },
            { text: "been", tip: "Past participle of 'be'" },
            { text: "+", tip: "" },
            { text: "V-ing", tip: "Present Participle" }
        ],
        desc: "Duration of an activity up to a specific time in the future.",
        usage: ["Duration leading to future point"],
        signals: ["By next year", "For 10 years"],
        example: "By 2026, I will have been teaching for 10 years.",
        viz: [{ type: 'range', l: 55, w: 35, label: 'Duration', y: 50 }, { type: 'marker', l: 90, label: 'Time Limit', y: 75 }]
    },

    // PAST FUTURE GROUP
    pastFutureSimple: {
        cat: 'Past Future', color: 'orange',
        title: "Past Future Simple",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "would", tip: "Past form of 'will'" },
            { text: "+", tip: "" },
            { text: "V1", tip: "Base verb form" }
        ],
        desc: "An action predicted/promised in the past for the future.",
        usage: ["Future from past perspective", "Hypothetical (Conditional 2)"],
        signals: ["The next day", "If I were you"],
        example: "He said he would buy the car.",
        viz: [{ type: 'pin', l: 20, label: 'He Said', y: 50 }, { type: 'arrow', l: 20, w: 15, label: '"Would..."', y: 30, dashed: true }, { type: 'pin', l: 35, label: 'Action', y: 50, ghost: true }]
    },
    pastFutureCont: {
        cat: 'Past Future', color: 'orange',
        title: "Past Future Cont.",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "would be", tip: "Conditional progressive" },
            { text: "+", tip: "" },
            { text: "V-ing", tip: "Present Participle" }
        ],
        desc: "Action predicted to be in progress in the future (from a past perspective).",
        usage: ["Imagined duration", "Conditional Continuous"],
        signals: ["At that time"],
        example: "I thought I would be working.",
        viz: [{ type: 'pin', l: 20, label: 'Thought', y: 50 }, { type: 'range', l: 30, w: 15, label: 'Would be doing...', y: 50, ghost: true }]
    },
    pastFuturePerfect: {
        cat: 'Past Future', color: 'orange',
        title: "Past Future Perfect",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "would have", tip: "Conditional perfect" },
            { text: "+", tip: "" },
            { text: "V3", tip: "Past Participle" }
        ],
        desc: "Hypothetical action that didn't happen in the past (Conditional Type 3).",
        usage: ["Regrets", "Impossible conditions"],
        signals: ["If + had V3"],
        example: "I would have helped if I knew.",
        viz: [{ type: 'pin', l: 30, label: 'Did NOT Happen', y: 50, cross: true }, { type: 'arrow', l: 30, w: 10, label: 'Imagined', y: 65 }]
    },
    pastFuturePerfectCont: {
        cat: 'Past Future', color: 'orange',
        title: "Past Future Perf. Cont.",
        formulaParts: [
            { text: "S", tip: "Subject" },
            { text: "+", tip: "" },
            { text: "would have", tip: "Conditional perfect" },
            { text: "+", tip: "" },
            { text: "been", tip: "Past participle of 'be'" },
            { text: "+", tip: "" },
            { text: "V-ing", tip: "Present Participle" }
        ],
        desc: "Hypothetical duration in the past.",
        usage: ["Imaginary duration in past"],
        signals: ["If + had V3"],
        example: "I would have been sleeping.",
        viz: [{ type: 'range', l: 20, w: 20, label: 'Would have been...', y: 50, ghost: true, cross: true }]
    }
};
