const { MessageEmbed, MessageButton, MessageActionRow} = require('discord.js');
const { } = require("../sessionTools.js")

module.exports = {
    config:{},
    data:{
        name:"tutorialSkip"
    },
    async execute(interaction,componentConfig,callback){
        const embed = new MessageEmbed;
        embed.setColor("#7289da")
        
        let other = ""
        other += "\n\n`/duel` - Lets you challenge another Discord User to a 1v1 fight with predetermined stats/abilities"
        other += "\n\n`/makelobby` - Create a lobby where other adventurers can join for PvP or Co-op battles"
        other += "\n\n`/challenges` - View challenges that can be completed in combat for rewards"
        other += "\n\n`/relocate` - Move a session window to a different channel incase one is becoming crowded"
        other += "\n\n`/remove` - Clears all progression"
        
        embed.setTitle("Freedom RPG Tutorial")
        embed.addField("Other Commands:", "Some other commands that you may find useful are:" + other)

        
        let removeRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
            .setCustomId('deleteMessage')
            .setLabel("Dismiss")
            .setStyle('DANGER'))

        interaction.update({
            content: " ",
            embeds: [embed],
            components: [removeRow],
            ephemeral: false,
        })

        let updates = [{
            id:interaction.user.id,
            path:"tutorial",
            value:"completed"
        }]
    
        callback({
            updatePlayer:updates
        })
    }
}