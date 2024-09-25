const { SlashCommandBuilder} = require('@discordjs/builders');
const { populateConformationControls, populateConformationWindow } = require("../sessionTools.js")

module.exports = {
        data: new SlashCommandBuilder()
                .setName('duel')
                .setDescription('Challenge another discord user to a fair fight')
                .addUserOption(option =>
                        option.setName("player")
                        .setDescription("User you would like to battle")
                        .setRequired(true)
                )
                .addStringOption(option =>
                        option.setName('life_count')
                        .setDescription('Number of lives each fighter will have')
                        .setRequired(true)
                        .addChoice('1 Life', '1')
                        .addChoice('2 Lives', '2')
                        .addChoice('3 Lives', '3')),
        config:{
                getSessions:true
        },
        async execute(interaction,commandConfig,callback){
                let id = commandConfig.choices[0].value
                if(!commandConfig.choices[0].user.bot){
                        var inSession = false;
                        for(session of commandConfig.sessions){
                                if(session.user_ids.includes(user.id)){
                                        inSession = true;
                                        break;
                                }
                        }
                        if(!inSession){
                                let newSession = {
                                        type:"duelRequest",
                                        session_id: Math.floor(Math.random() * 100000),
                                        user_ids:[interaction.user.id,id],
                                        session_data:{
                                                lifeCount:commandConfig.choices[1].value,
                                                names:[interaction.user.username,commandConfig.choices[0].user.username]
                                        }
                                }
        
                                interaction.reply({
                                        content: "<@" + id + ">",
                                        embeds: populateConformationWindow(newSession),
                                        components: populateConformationControls(newSession)
                                })
        
                                callback({
                                        addSession:newSession
                                })
                        } else {
                                interaction.reply({ content: 'You cannot challenge that user while either of you are in another session', ephemeral: true });
                        }
                } else {
                        interaction.reply({ content: 'You cannot challenge bot users to duels', ephemeral: true });
                    }
                
        }
};
