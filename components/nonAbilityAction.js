const { MessageActionRow, MessageSelectMenu, MessageButton, MessageEmbed } = require('discord.js');
const { stanceDesc, stanceDict} = require("../data.json")
const executeEmpower = require("../components/empower.js").execute;
const executeFlee = require("../components/flee.js").execute;
const executeFighter = require("../components/myAbilities.js").execute;
const executeLogs = require("../components/sendLogs.js").execute;

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"nonAbilityAction"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        session.session_data.m_id = interaction.message.id
        session.session_data.c_id = interaction.message.channelId
        if(session.type == "combat"){
            switch(interaction.values[0]){
                case "flee":
                    executeFlee(interaction,componentConfig,callback)
                    break;

                case "fighter":
                    executeFighter(interaction,componentConfig,callback)
                    break;

                case "empower":
                    executeEmpower(interaction,componentConfig,callback)
                    break;

                case "stance":
                    let embed = new MessageEmbed()
                    .setColor("#7289da")
			        .setTitle("Change Stance")

                    embed.addField("Stance Selection","Select a combat stance you wish to enter")

                    let stanceOptions = []
                    for(fighter of session.session_data.fighters){
                        if(fighter.staticData.id == interaction.user.id){
                            for(stance in fighter.staticData.stances){
                                if(fighter.staticData.stances[stance].active && fighter.staticData.stance != stance){
                                    stanceOptions.push({
                                        label: "Switch to the " + stanceDict[stance] + " stance",
                                        description: stanceDesc[stance],
                                        value: stance,
                                    })
                                }
                            }
                            break;
                        }
                    }
                    const row = new MessageActionRow()
                    if(stanceOptions.length > 0){
                        row.addComponents(
                            new MessageSelectMenu()
                                .setCustomId('selectStance_' + session.session_id)
                                .setPlaceholder('Select a Stance')
                                .addOptions(stanceOptions),
                        )

                        interaction.reply({
                            content: " ",
                            components: [row],
                            embeds: [embed],
                            ephemeral: true
                        })
                        break;
                    } else {
                        interaction.reply({
                            content: "You have no stances learned to swap to. You learn them over time by taking damage, dealing damage, and blocking attacks",
                            ephemeral: true
                        })
                        break;
                    }
                    
                    

                    

                case "logs":
                    executeLogs(interaction,componentConfig,callback)
                    break;

            }
        }
    }
}