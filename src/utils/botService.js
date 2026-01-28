export const parseBotCommand = (text) => {
    if (!text.startsWith('/')) return null;
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (command === '/help') {
        return {
            command: 'help',
            response: "🤖 AuraBot Commands:\n/help - Show this message\n/remind [msg] [secs] - Set a reminder"
        };
    }

    if (command === '/remind') {
        const time = parseInt(args[args.length - 1]);
        const message = args.slice(0, -1).join(' ');
        if (isNaN(time) || !message) {
            return { response: "❌ Usage: /remind [message] [seconds]" };
        }
        return {
            command: 'remind',
            message,
            time,
            response: `✅ I'll remind you in ${time}s`
        };
    }
    return null;
};
