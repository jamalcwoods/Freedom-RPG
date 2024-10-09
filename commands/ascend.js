const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require('discord.js');
const { challengeDict } = require("../data.json")
const { msToTime } = require("../tools.js")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('ascend')
		.setDescription('Access new limits of power for a town or designate a signature ability'),
    config:{
        getPlayerData:true,
        getGuildTown:true
    },
	async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData
        if(playerData.level >= 50){
            let townData = componentConfig.townData

            let now = new Date();
            
            const embed = new MessageEmbed;
            embed.setColor("#7289da")
            
            embed.setTitle(playerData.name + "'s Ascension")
            let infoText = "Ascending allows a player to choose between setting a signature ability or providing a progression boost for a town of their choosing."
            infoText += "\nThis comes at the cost of resetting their character while also removing the level limitation when creating abilities"
            infoText += "\n\n**Signature Ability**\n"
            infoText += "Players have a chance to perform their signature ability every time they use an ability.\nThis chance increases as their level goes up and is even further increased when their health is low"
            infoText += "\n\n**Town Progression Boost**\n"
            infoText += "Providing a boost to a town will instantly level up a town regardless of their progression towards the next level.\nThis results in better offers from it's vendors as well as access to more difficult raids and dungeon levels"
            infoText += "\n\nAdditionally, ascended players will have their level cap removed and will no longer need to meet level requirements when making an ability"
            embed.addField("Ascension Info",infoText)
            
            let newSession = {
                type:"ascend",
                session_id: Math.floor(Math.random() * 100000),
                user_ids:[playerData.id],
                session_data:{
                    confirming:false,
                    player:playerData,
                    town:townData
                }
            }

            let optionList = [{
                label: "Town Boost",
                description: "Progression Boost for " + townData.name,
                value: "0"
            }]

            for(var i = 0 ; i < playerData.abilities.length;i++){
                optionList.push({
                    label: playerData.abilities[i].name,
                    description: "Set " + playerData.abilities[i].name + " As Your Signature Ability" ,
                    value: (i + 1) + ""
                })
            }

            let options = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                .setCustomId('ascendOption_' + newSession.session_id)
                .setPlaceholder("Choose your ascension option")
                .addOptions(optionList)
            )

            interaction.reply({
                    content: " ",
                    embeds: [embed],
                    components: [options]
            })
            
            callback({
                addSession:newSession
            })
        } else {
            interaction.reply({ content: 'You must be at least level 50 to ascend', ephemeral: true });
        }
	},
};