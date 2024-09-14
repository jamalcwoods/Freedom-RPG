const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { challengeDict } = require("../data.json")
const { msToTime } = require("../tools.js")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('remove')
		.setDescription('Remove your character profile'),
    config:{
        getPlayerData:true
    },
	async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData
        const embed = new MessageEmbed;
        embed.setColor("#7289da")
        embed.setTitle("Account Removal")
        
        let infoText = "Are you sure you want to remove your character profile? Doing this will delete all progress"
        embed.addField("Profile Deletion",infoText)
        
        let newSession = {
            type:"remove",
            session_id: Math.floor(Math.random() * 100000),
            user_ids:[playerData.id],
            session_data:{}
        }

        let options = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('cancel_' + newSession.session_id)
                .setLabel('Cancel')
                .setStyle('DANGER'),
            new MessageButton()
                .setCustomId('removeAccount_' + newSession.session_id)
                .setLabel('Remove Character')
                .setStyle('PRIMARY')
        )

        interaction.reply({
                content: " ",
                embeds: [embed],
                components: [options]
        })
        
        callback({
            addSession:newSession
        })
	},
};