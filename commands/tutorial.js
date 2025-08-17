const { SlashCommandBuilder} = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { tutorialSteps } = require("../data.json")
const { msToTime } = require("../tools.js")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('tutorial')
		.setDescription('Access the tutorial'),
    config:{
        getPlayerData:true,
        sessionCommand:true,
        getSessions:true
    },
	async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData
        let fail = false
        for(s of componentConfig.sessions){
            if(s.user_ids[0] == interaction.user.id){
                if(s.type == 'combat'){
                    playerData = s.session_data.fighters[0].staticData
                } else {
                    playerData = s.session_data.player
                }
            } else if (s.user_ids.includes(interaction.user.id)) {
                interaction.reply({ content: "You can not access the tutorial while being part of another player's session", ephemeral: true }); 
                fail = true
                break;
            }
        }
        
        let updates = []

        if(!fail && playerData != undefined){
            const embed = new MessageEmbed;
            embed.setColor("#7289da")
            
            let removeRow = new MessageActionRow()
            .addComponents(
                new MessageButton()
                .setCustomId('deleteMessage')
                .setLabel("Dismiss")
                .setStyle('DANGER')
            )

            if(playerData.tutorial != 'completed'){
                if(!playerData.tutorial){
                    updates.push({
                        id:playerData.id,
                        path:"tutorial",
                        value:0
                    })
                    playerData.tutorial = 0
                }
                embed.setTitle("Freedom RPG Tutorial")  
                embed.addField("Next Objective:","**" + tutorialSteps[playerData.tutorial].title + "**\n\n" + tutorialSteps[playerData.tutorial].instructions)
                removeRow.addComponents(
                    new MessageButton()
                    .setCustomId('tutorialSkip_NULL')
                    .setLabel("Skip Tutorial")
                    .setStyle('PRIMARY')
                )
            } else {
                let other = ""
                other += "\n\n`/duel` - Lets you challenge another Discord User to a 1v1 fight with predetermined stats/abilities"
                other += "\n\n`/makelobby` - Create a lobby where other adventurers can join for PvP or Co-op battles"
                other += "\n\n`/challenges` - View challenges that can be completed in combat for rewards"
                other += "\n\n`/relocate` - Move a session window to a different channel incase one is becoming crowded"
                other += "\n\n`/remove` - Clears all progression"
                
                embed.setTitle("Freedom RPG Tutorial")
                embed.addField("Other Commands:", "Some other commands that you may find useful are:" + other)
            }

            interaction.reply({
                content: " ",
                embeds: [embed],
                components: [removeRow],
                ephemeral: false,
            })
            
            
        }
        callback({
            updatePlayer:updates
        })
        
	},
};