Required JSON files in GitHub repository (my-bot-data):

1. moderation.json
```json
{
    "messageLog": [],
    "kicks": [],
    "bans": [],
    "mutes": [],
    "warnings": {}
}
```

2. levels.json
```json
{
    "guilds": {
        "guildId": {
            "levelUpChannel": "channelId",
            "userId": {
                "messages": 0,
                "totalMessages": 0,
                "lastActivity": null,
                "messageHistory": []
            }
        }
    }
}
```

3. economy.json
```json
{
    "guilds": {
        "guildId": {
            "settings": {
                "currency": "💰",
                "dailyReward": 200,
                "gambling": {
                    "minBet": 10,
                    "maxBet": 10000
                }
            },
            "economy": {}
        }
    }
}
```

4. config.json
```json
{
    "guilds": {
        "guildId": {
            "modlogChannel": null,
            "levelRoles": {},
            "filter": {
                "words": {},
                "bypassRoles": []
            }
        }
    }
}
```

5. timers.json
```json
{
    "timers": [],
    "reminders": []
}
```
