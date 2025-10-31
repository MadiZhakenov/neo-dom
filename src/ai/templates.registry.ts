// src/ai/templates.registry.ts

export const TEMPLATES_REGISTRY = {
    'agymdagy-zhondeu-zhurgizu-protsesinde-kalyptastyrilg-an-tekhnikalyk-zhane-oryndaushylyk-kuzhattamany-kabyldau-tapsyru-aktisinin-nysany.docx': {
        name: 'Ағымдағы жөндеу жүргізу процесінде қалыптастырылған техникалық жəне орындаушылық құжаттаманы қабылдау-тапсыру актісінің нысаны',
        language: 'kz',
        fields: [
            { tag: 'act_address', label: 'Объектінің мекенжайы', type: 'text'},
            { tag: 'sender_fio', label: 'Тапсырушы тараптың Аты-жөні', type: 'text' },
            { tag: 'sender_position', label: 'Тапсырушының лауазымы', type: 'text' },
            { tag: 'receiver_fio', label: 'Қабылдаушы тараптың Аты-жөні', type: 'text' },
            { tag: 'receiver_position', label: 'Қабылдаушының лауазымы', type: 'text' },
            { 
                tag: 'docs', 
                label: 'Тапсырылатын құжаттар', 
                type: 'loop', 
                subFields: [
                    { tag: 'index', label: '№', type: 'number' },
                    { tag: 'name', label: 'Құжаттың атауы', type: 'text' },
                    { tag: 'notes', label: 'Ескертпе (түпнұсқа/көшірме)', type: 'text' }
                ]
            },
            { tag: 'receiver_date', label: 'Қабылдау күні', type: 'date' },
            { tag: 'sender_date', label: 'Тапсыру күні', type: 'date' },
        ]
    },
    'forma-akta-podtverzhdayushchego-fakt-izmeneniya-zakazchikom-obema-periodichnosti-vypolneniya-rabot-ili-ikh-stoimosti-tseny.docx': {
        name: 'Форма акта, подтверждающего факт изменения заказчиком объема, периодичности выполнения работ или их стоимости (цены)',
        language: 'ru',
        fields: [
            { tag: 'change_description', label: 'Описание изменений', type: 'textarea' },
            { tag: 'property_address', label: 'Адрес объекта', type: 'text' },
            { tag: 'decision_body', label: 'Орган, принявший решение', type: 'text' },
            { tag: 'customer_details', label: 'Данные заказчика', type: 'textarea' },
            { tag: 'performer_details', label: 'Данные исполнителя', type: 'textarea' },
            { 
                tag: 'work_items', 
                label: 'Работы', 
                type: 'loop', 
                subFields: [
                    { tag: 'index', label: '№', type: 'number' },
                    { tag: 'work_name', label: 'Наименование работы', type: 'text' },
                    { tag: 'standard_cost', label: 'Нормативная стоимость', type: 'number' },
                    { tag: 'cost_calculation_schedule', label: 'График расчета стоимости', type: 'text' },
                    { tag: 'change_justification', label: 'Обоснование изменений', type: 'textarea' },
                    { tag: 'new_work_cost', label: 'Новая стоимость работы', type: 'number' },
                    { tag: 'new_schedule_cost', label: 'Новая стоимость по графику', type: 'number' }
                ]
            },
            { tag: 'change_consequences', label: 'Последствия изменений', type: 'textarea' },
            { tag: 'performer_date', label: 'Дата подписания исполнителем', type: 'date' },
            { tag: 'customer_date', label: 'Дата подписания заказчиком', type: 'date' },
        ]
    },
    'forma-akta-priyema-peredachi-tekhnicheskoy-dokumentatsii-dlya-provedeniya-kapitalnogo-remonta-imushchestva.docx': {
        name: 'Форма акта приема-передачи технической документации для проведения капитального ремонта имущества',
        language: 'ru',
        fields: [
            { tag: 'property_address', label: 'Адрес объекта', type: 'text' },
            { tag: 'transferring_party_details', label: 'Данные передающей стороны', type: 'textarea' },
            { tag: 'accepting_party_details', label: 'Данные принимающей стороны', type: 'textarea' },
            { 
                tag: 'documents', 
                label: 'Передаваемые документы', 
                type: 'loop', 
                subFields: [
                    { tag: 'doc_index', label: '№', type: 'number' },
                    { tag: 'doc_name', label: 'Наименование документа', type: 'text' },
                    { tag: 'doc_quantity', label: 'Количество листов', type: 'number' },
                    { tag: 'doc_notes', label: 'Примечание', type: 'text' }
                ]
            },
            { tag: 'accepting_party_date', label: 'Дата приемки', type: 'date' },
            { tag: 'transferring_party_date', label: 'Дата передачи', type: 'date' },
        ]
    },
    'forma-akta-priyema-peredachi-tekhnicheskoy-dokumentatsii-dlya-provedeniya-tekushchego-remonta-imushchestva.docx': {
        name: 'Форма акта приёма-передачи технической документации для проведения текущего ремонта имущества',
        language: 'ru',
        fields: [
            { tag: 'property_address', label: 'Адрес объекта', type: 'text' },
            { tag: 'customer_details', label: 'Данные заказчика', type: 'textarea' },
            { tag: 'contractor_details', label: 'Данные подрядчика', type: 'textarea' },
            { 
                tag: 'documents', 
                label: 'Передаваемые документы', 
                type: 'loop', 
                subFields: [
                    { tag: 'doc_index', label: '№', type: 'number' },
                    { tag: 'doc_name', label: 'Наименование документа', type: 'text' },
                    { tag: 'doc_notes', label: 'Примечание (оригинал/копия)', type: 'text' }
                ]
            },
            { tag: 'accepting_party_date', label: 'Дата приемки', type: 'date' },
            { tag: 'transferring_party_date', label: 'Дата передачи', type: 'date' },
        ]
    },
    'forma-akta-priyema-peredachi-tekhnicheskoy-i-inoy-dokumentatsii-na-mnogokvartirnyy-zhilyy-dom.docx': {
        name: 'Форма акта приема-передачи технической и иной документации на многоквартирный жилой дом',
        language: 'ru',
        fields: [
            { tag: 'property_address', label: 'Адрес МКД', type: 'text' },
            { tag: 'transferor_details', label: 'Данные передающей стороны', type: 'textarea' },
            { tag: 'acceptor_details', label: 'Данные принимающей стороны', type: 'textarea' },
            { 
                tag: 'documents', 
                label: 'Передаваемые документы', 
                type: 'loop', 
                subFields: [
                    { tag: 'doc_index', label: '№', type: 'number' },
                    { tag: 'doc_name', label: 'Наименование документа', type: 'text' },
                    { tag: 'doc_sheet_count', label: 'Количество листов', type: 'number' },
                    { tag: 'doc_notes', label: 'Примечание', type: 'text' }
                ]
            },
            { tag: 'acceptor_date', label: 'Дата приемки', type: 'date' },
            { tag: 'transferor_date', label: 'Дата передачи', type: 'date' },
        ]
    },
    'forma-akta-priyema-peredachi-tekhnicheskoy-i-ispolnitelnoy-dokumentatsii-sformirovannoy-v-protsesse-provedeniya-kapitalnogo-remonta.docx': {
        name: 'Форма акта приема-передачи технической и исполнительной документации, сформированной в процессе проведения капитального ремонта',
        language: 'ru',
        fields: [
            { tag: 'property_address', label: 'Адрес объекта', type: 'text' },
            { tag: 'technical_customer_details', label: 'Данные техзаказчика', type: 'textarea' },
            { tag: 'managing_entity_details', label: 'Данные управляющей организации', type: 'textarea' },
            { 
                tag: 'documents', 
                label: 'Передаваемые документы', 
                type: 'loop', 
                subFields: [
                    { tag: 'doc_index', label: '№', type: 'number' },
                    { tag: 'doc_name', label: 'Наименование документа', type: 'text' },
                    { tag: 'doc_sheet_count', label: 'Количество листов', type: 'number' },
                    { tag: 'doc_notes', label: 'Примечание', type: 'text' }
                ]
            },
            { tag: 'acceptor_date', label: 'Дата приемки', type: 'date' },
            { tag: 'transferor_date', label: 'Дата передачи', type: 'date' },
        ]
    },
    'forma-akta-priyema-peredachi-tekhnicheskoy-i-ispolnitelnoy-dokumentatsii-sformirovannoy-v-protsesse-provedeniya-tekushchego-remonta.docx': {
        name: 'Форма акта приёма-передачи технической и исполнительной документации, сформированной в процессе проведения текущего ремонта',
        language: 'ru',
        fields: [
            { tag: 'property_address', label: 'Адрес объекта', type: 'text' },
            { tag: 'customer_details', label: 'Данные заказчика', type: 'textarea' },
            { tag: 'contractor_details', label: 'Данные подрядчика', type: 'textarea' },
            { 
                tag: 'documents', 
                label: 'Передаваемые документы', 
                type: 'loop', 
                subFields: [
                    { tag: 'doc_index', label: '№', type: 'number' },
                    { tag: 'doc_name', label: 'Наименование документа', type: 'text' },
                    { tag: 'doc_notes', label: 'Примечание (оригинал/копия)', type: 'text' }
                ]
            },
            { tag: 'acceptor_date', label: 'Дата приемки', type: 'date' },
            { tag: 'transferor_date', label: 'Дата передачи', type: 'date' },
        ]
    },
'forma-akta-sdachi-priyemki-rabot-vypolnennykh-v-protsesse-kapitalnogo-remonta-imushchestva.docx': {
    name: 'Форма акта сдачи-приемки работ, выполненных в процессе капитального ремонта имущества',
    language: 'ru',
    fields: [
        { tag: 'approval_date', label: 'Дата утверждения протокола', type: 'date' },
        { tag: 'approval_protocol_num', label: 'Номер протокола', type: 'text' },
        { tag: 'act_address', label: 'Город составления акта', type: 'text' },
        { tag: 'act_date', label: 'Дата составления акта', type: 'date' },
        { tag: 'commission_assigner', label: 'Кем назначена комиссия', type: 'text' },
        { tag: 'order_date', label: 'Дата приказа/решения', type: 'date' },
        { tag: 'chairman_details', label: 'Председатель комиссии', type: 'text' },
        { tag: 'commission_member_organizations', label: 'Члены комиссии - представители организаций', type: 'textarea' },
        { tag: 'contractor_rep_details', label: 'Представитель подрядчика', type: 'text' },
        { tag: 'construction_control_rep_details', label: 'Представитель строительного контроля', type: 'text' },
        { tag: 'design_org_rep_details', label: 'Представитель проектной организации', type: 'text' },
        { tag: 'managing_entity_rep_details', label: 'Представитель управляющей организации', type: 'text' },
        { tag: 'local_authority_rep_details', label: 'Представитель местного исполнительного органа', type: 'text' },
        { tag: 'repaired_property_address', label: 'Адрес ремонтируемого объекта', type: 'text' },
        { tag: 'capital_repair_type', label: 'Вид капитального ремонта', type: 'text' },
        { tag: 'psd_developer', label: 'Разработчик проектно-сметной документации', type: 'text' },
        { tag: 'psd_approval_details', label: 'Утверждение проектно-сметной документации', type: 'textarea' },
        { 
            tag: 'contractors', 
            label: 'Подрядчики и выполненные работы', 
            type: 'loop', 
            subFields: [
                { tag: 'contractor_and_works', label: 'Подрядчик и выполненные работы', type: 'textarea' }
            ]
        },
        { tag: 'inspection_date', label: 'Дата инструментального осмотра', type: 'date' },
        { tag: 'inspection_organization', label: 'Организация, проводившая осмотр', type: 'text' },
        { tag: 'scheduled_start_date', label: 'Плановая дата начала работ', type: 'date' },
        { tag: 'actual_start_date', label: 'Фактическая дата начала работ', type: 'date' },
        { tag: 'scheduled_end_date', label: 'Плановая дата окончания работ', type: 'date' },
        { tag: 'actual_end_date', label: 'Фактическая дата окончания работ', type: 'date' },
        { tag: 'docs_assessment', label: 'Оценка представленной документации', type: 'textarea' },
        { tag: 'architectural_solutions_summary', label: 'Архитектурно-строительные решения', type: 'textarea' },
        { tag: 'defects_appendix_num', label: 'Номер приложения о дефектах', type: 'text' },
        { tag: 'estimated_cost', label: 'Сметная стоимость (тыс. тенге)', type: 'number' },
        { tag: 'actual_cost', label: 'Фактическая стоимость (тыс. тенге)', type: 'number' },
        { tag: 'quality_assessment_grade', label: 'Оценка качества выполненных работ', type: 'text' },
        { tag: 'final_project_indicators_summary', label: 'Показатели после капремонта', type: 'textarea' },
        { tag: 'energy_efficiency_class', label: 'Класс энергоэффективности', type: 'text' },
        { tag: 'sustainability_rating', label: 'Рейтинг устойчивости среды', type: 'text' },
        { tag: 'post_repair_condition_summary', label: 'Состояние после ремонта', type: 'textarea' },
        { tag: 'decision_property_location', label: 'Местоположение имущества для решения', type: 'text' },
        { tag: 'main_appendix_num', label: 'Номер основного приложения', type: 'text' },
        { tag: 'act_number', label: 'Номер акта', type: 'text' },
        { tag: 'final_protocol_copy_address', label: 'Адрес для копии протокола', type: 'text' },
        { tag: 'final_protocol_date', label: 'Дата финального протокола', type: 'date' },
        { tag: 'final_protocol_num', label: 'Номер финального протокола', type: 'text' },
        { tag: 'chairman_signature_fio', label: 'ФИО председателя комиссии для подписи', type: 'text' },
        {
            tag: 'commission_signatures',
            label: 'Члены комиссии (для подписи)',
            type: 'loop',
            subFields: [
                { tag: 'member_signature_fio', label: 'ФИО члена комиссии', type: 'text' }
            ]
        }
    ]
},
    'forma-akta-sdachi-priyemki-rabot-vypolnennykh-v-protsesse-tekushchego-remonta-imushchestva.docx': {
    name: 'Форма акта сдачи-приемки работ, выполненных в процессе текущего ремонта имущества',
    language: 'ru',
    fields: [
        { tag: 'approval_date', label: 'Дата утверждения протокола', type: 'date' },
        { tag: 'approval_protocol_num', label: 'Номер протокола', type: 'text' },
        { tag: 'act_address', label: 'Город составления акта', type: 'text' },
        { tag: 'act_date', label: 'Дата составления акта', type: 'date' },
        { tag: 'commission_assigner', label: 'Кем назначена комиссия', type: 'text' },
        { tag: 'order_date', label: 'Дата приказа/решения', type: 'date' },
        { tag: 'chairman_details', label: 'Председатель комиссии', type: 'text' },
        { tag: 'commission_member_organizations', label: 'Члены комиссии - представители организаций', type: 'textarea' },
        { tag: 'contractor_rep_details', label: 'Представитель подрядчика', type: 'text' },
        { tag: 'construction_control_rep_details', label: 'Представитель строительного контроля', type: 'text' },
        { tag: 'design_org_rep_details', label: 'Представитель проектной организации', type: 'text' },
        { tag: 'performer_rep_details', label: 'Представитель исполнителя', type: 'text' },
        { tag: 'local_authority_rep_details', label: 'Представитель органов местного самоуправления', type: 'text' },
        { tag: 'repaired_property_address', label: 'Адрес ремонтируемого объекта', type: 'text' },
        { tag: 'psd_developer', label: 'Разработчик проектно-сметной документации', type: 'text' },
        { tag: 'psd_approval_details', label: 'Утверждение проектно-сметной документации', type: 'textarea' },
        { tag: 'contractor_and_works', label: 'Подрядчик и выполненные работы', type: 'textarea' },
        { tag: 'inspection_date', label: 'Дата инструментального осмотра', type: 'date' },
        { tag: 'inspection_organization', label: 'Организация, проводившая осмотр', type: 'text' },
        { tag: 'scheduled_start_date', label: 'Плановая дата начала работ', type: 'date' },
        { tag: 'actual_start_date', label: 'Фактическая дата начала работ', type: 'date' },
        { tag: 'scheduled_end_date', label: 'Плановая дата окончания работ', type: 'date' },
        { tag: 'actual_end_date', label: 'Фактическая дата окончания работ', type: 'date' },
        { tag: 'docs_assessment', label: 'Оценка представленной документации', type: 'textarea' },
        { tag: 'architectural_solutions_summary', label: 'Архитектурно-строительные решения', type: 'textarea' },
        { tag: 'defects_deadline_date', label: 'Срок устранения дефектов', type: 'date' },
        { tag: 'defects_appendix_num', label: 'Номер приложения о дефектах', type: 'text' },
        { tag: 'estimated_cost', label: 'Сметная стоимость (т.т.)', type: 'number' },
        { tag: 'actual_cost', label: 'Фактическая стоимость (т.т.)', type: 'number' },
        { tag: 'quality_assessment_grade', label: 'Оценка качества выполненных работ', type: 'text' },
        { tag: 'final_project_indicators_summary', label: 'Показатели после текущего ремонта', type: 'textarea' },
        { tag: 'energy_efficiency_class', label: 'Класс энергоэффективности', type: 'text' },
        { tag: 'sustainability_rating', label: 'Рейтинг устойчивости среды', type: 'text' },
        { tag: 'post_repair_condition_summary', label: 'Состояние после ремонта', type: 'textarea' },
        { tag: 'decision_property_location', label: 'Местоположение имущества для решения', type: 'text' },
        { tag: 'main_appendix_num', label: 'Номер основного приложения', type: 'text' },
        { tag: 'act_number', label: 'Номер акта', type: 'text' },
        { tag: 'act_day', label: 'День составления акта (число)', type: 'number' },
        { tag: 'act_month', label: 'Месяц составления акта', type: 'text' },
        { tag: 'act_year', label: 'Год составления акта', type: 'number' },
        { tag: 'final_protocol_copy_address', label: 'Адрес для копии протокола', type: 'text' },
        { tag: 'final_protocol_date', label: 'Дата финального протокола', type: 'date' },
        { tag: 'chairman_signature_fio', label: 'ФИО председателя комиссии для подписи', type: 'text' },
        {
            tag: 'commission_signatures',
            label: 'Члены комиссии (для подписи)',
            type: 'loop',
            subFields: [
                { tag: 'member_signature_fio', label: 'ФИО члена комиссии', type: 'text' }
            ]
        }
    ]
},
    'forma-otcheta-zaklyucheniya-po-itogam-instrumentalnogo-osmotra-mnogokvartirnogo-zhilogo-doma.docx': {
    name: 'Форма отчета (заключения) по итогам инструментального осмотра многоквартирного жилого дома',
    language: 'ru',
    fields: [
        { tag: 'organization_name', label: 'Наименование организации', type: 'text' },
        { tag: 'organization_credentials', label: 'Реквизиты организации', type: 'textarea' },
        { tag: 'property_address', label: 'Адрес многоквартирного жилого дома', type: 'text' },
        { tag: 'technical_assignment', label: 'Техническое задание на выполнение осмотра', type: 'textarea' },
        { tag: 'inspection_type', label: 'Вид осмотра', type: 'text' },
        { tag: 'inspection_period', label: 'Время проведения осмотра', type: 'text' },
        { tag: 'inspectors_and_qualifications', label: 'Специалисты проводившие осмотр и их квалификация', type: 'textarea' },
        { tag: 'design_organization', label: 'Проектная организация, проектировавшая МКД', type: 'text' },
        { tag: 'construction_organization', label: 'Строительная организация, возводившая МКД', type: 'text' },
        { tag: 'year_of_construction', label: 'Год возведения', type: 'number' },
        { tag: 'last_major_repair_details', label: 'Год и характер выполнения последнего капитального ремонта или реконструкции', type: 'textarea' },
        { tag: 'operating_instructions_requirements', label: 'Требования, указания и предписания инструкции по эксплуатации', type: 'textarea' },
        { tag: 'building_structural_type', label: 'Конструктивный тип многоквартирного жилого дома', type: 'text' },
        { tag: 'inspection_regulations', label: 'Правила, с использованием которых проводился осмотр', type: 'textarea' },
        { tag: 'inspection_tools_and_equipment', label: 'Инструменты и приспособления, использованные при осмотре', type: 'textarea' },
        { tag: 'executed_works_list', label: 'Выполняемые работы', type: 'textarea' },
        { tag: 'identified_deviations_and_changes', label: 'Выявленные изменения, отклонения от проектных и т.д.', type: 'textarea' },
        { tag: 'deformations_and_damages_classification', label: 'Классификация и причины возникновения деформаций и повреждений', type: 'textarea' },
        { tag: 'quality_and_condition_assessment', label: 'Оценка качества и состояния осматриваемого имущества или его частей', type: 'textarea' },
        { tag: 'obtained_parameters', label: 'Полученные показатели (параметры)', type: 'textarea' },
        { tag: 'overall_condition_assessment', label: 'Общая оценка ситуации', type: 'textarea' },
        { tag: 'urgent_safety_issues', label: 'Информация, требующая экстренного решения возникших проблем безопасности', type: 'textarea' },
        { tag: 'physical_wear_and_tear_details', label: 'Физический износ (процент износа) осматриваемого имущества или его частей', type: 'textarea' },
        { tag: 'recommended_works_for_restoration', label: 'Состав работ, выполнение которых обеспечит восстановление нормативного состояния', type: 'textarea' },
        { tag: 'changes_to_operating_instructions', label: 'Изменения, которые внесены в инструкцию по эксплуатации по итогам осмотра', type: 'textarea' },
        { tag: 'current_technical_condition_category', label: 'Установленная категория текущего технического состояния объекта', type: 'text' },
        { tag: 'technical_documentation_compiled', label: 'Техническая документация, сформированная по итогам осмотра', type: 'textarea' }
    ]
},
    'kop-paterli-turgyn-uidi-instrumenttik-tekseru-korytyndylary-boiynsha-esep-teme-korytyndy-formasy.docx': {
    name: 'Көп пәтерлі тұрғын үйді инструменттік тексеру қорытындылары бойынша есептеме (қорытынды) формасы',
    language: 'kz',
    fields: [
        { tag: 'organization_name', label: 'Есептемені құрастырған ұйымның атауы', type: 'text' },
        { tag: 'organization_credentials', label: 'Ұйымның реквизиттері', type: 'textarea' },
        { tag: 'property_address', label: 'Көп пәтерлі тұрғын үйдің мекен-жайы', type: 'text' },
        { tag: 'technical_assignment', label: 'Тексерісті орындауға техникалық тапсырма', type: 'textarea' },
        { tag: 'inspection_type', label: 'Тексеріс түрі', type: 'text' },
        { tag: 'inspection_period', label: 'Тексерісті өткізу уақыты', type: 'text' },
        { tag: 'inspectors_and_qualifications', label: 'Тексерісті өткізген мамандар және олардың біліктілігі', type: 'textarea' },
        { tag: 'design_organization', label: 'Көп пәтерлі тұрғын үйді жобалаған жобалық ұйым', type: 'text' },
        { tag: 'construction_organization', label: 'Көп пәтерлі тұрғын үйді тұрғызған құрылыс ұйымы', type: 'text' },
        { tag: 'year_of_construction', label: 'Тұрғызылған жылы', type: 'number' },
        { tag: 'last_major_repair_details', label: 'Соңғы күрделі жөндеудің немесе реконструкциялаудың орындалған жылы және сипаты', type: 'textarea' },
        { tag: 'operating_instructions_requirements', label: 'Пайдалану жөніндегі нұсқаулық талаптары, нұсқаулары және нұсқамалары', type: 'textarea' },
        { tag: 'building_structural_type', label: 'Көп пәтерлі тұрғын үйдің конструктивтік түрі', type: 'text' },
        { tag: 'inspection_regulations', label: 'Тексеріс оларды пайдалана отырып өткізілген ережелер', type: 'textarea' },
        { tag: 'inspection_tools_and_equipment', label: 'Тексеріс кезінде пайдаланылған инструменттер мен керек-жарақтар', type: 'textarea' },
        { tag: 'executed_works_list', label: 'Орындалатын жұмыстар', type: 'textarea' },
        { tag: 'identified_deviations_and_changes', label: 'Анықталған өзгерістер, жобалық көрсеткіштерден ауытқулар және т.б.', type: 'textarea' },
        { tag: 'deformations_and_damages_classification', label: 'Деформациялар мен зақымданулардың жіктемесі және орын алу себептері', type: 'textarea' },
        { tag: 'quality_and_condition_assessment', label: 'Тексеріліп отырған мүліктің немесе оның бөліктерінің сапасын және жағдайын бағалау', type: 'textarea' },
        { tag: 'obtained_parameters', label: 'Алынған көрсеткіштер (параметрлер)', type: 'textarea' },
        { tag: 'overall_condition_assessment', label: 'Жағдайдың жалпы бағасы', type: 'textarea' },
        { tag: 'urgent_safety_issues', label: 'Орын алған қауіпсіздік мәселелерін жедел шешуді талап ететін ақпарат', type: 'textarea' },
        { tag: 'physical_wear_and_tear_details', label: 'Тексеріліп отырған мүліктің немесе оның бөліктерінің физикалық тозуы (тозу пайызы)', type: 'textarea' },
        { tag: 'recommended_works_for_restoration', label: 'Мүліктің нормативтік техникалық жағдайын қалпына келтіретін жұмыстар құрамы', type: 'textarea' },
        { tag: 'changes_to_operating_instructions', label: 'Тексеріс қорытындылары бойынша пайдалану нұсқаулығына енгізілген өзгертулер', type: 'textarea' },
        { tag: 'current_technical_condition_category', label: 'Объектінің ағымдағы техникалық жағдайының анықталған категориясы', type: 'text' },
        { tag: 'technical_documentation_compiled', label: 'Тексеріс қорытындылары бойынша құрастырылған техникалық құжаттама', type: 'textarea' }
    ]
},
    'mulikke-agymdagy-zhondeudi-zhurgizuge-arnalgan-tekhnikalyk-kuzhattamany-kabyldau-tapsyru-aktisinin-nysany.docx': {
        name: 'Мүлікке ағымдағы жөндеуді жүргізуге арналған техникалық құжаттаманың қабылдау-тапсыру актісінің нысаны',
        language: 'kz',
        fields: [
            { tag: 'address', label: 'Объектінің мекенжайы', type: 'text' },
            { tag: 'sender_fio', label: 'Тапсырушы тараптың Аты-жөні', type: 'text' },
            { tag: 'sender_position', label: 'Тапсырушының лауазымы', type: 'text' },
            { tag: 'receiver_fio', label: 'Қабылдаушы тараптың Аты-жөні', type: 'text' },
            { tag: 'receiver_position', label: 'Қабылдаушының лауазымы', type: 'text' },
            { 
                tag: 'docs', 
                label: 'Тапсырылатын құжаттар', 
                type: 'loop', 
                subFields: [
                    { tag: 'index', label: '№', type: 'number' },
                    { tag: 'name', label: 'Құжаттың атауы', type: 'text' },
                    { tag: 'notes', label: 'Ескертпе (түпнұсқа/көшірме)', type: 'text' }
                ]
            },
            { tag: 'receiver_date', label: 'Қабылдау күні', type: 'date' },
            { tag: 'sender_date', label: 'Тапсыру күні', type: 'date' },
        ]
    },
    'mulikti-agymdagy-zhondeu-protsesinde-oryndalgan-tapsyru-kabyldau-zhumystary-aktisinin-nysany.docx': {
    name: 'Мүлікті ағымдағы жөндеу процесінде орындалған тапсыру-қабылдау жұмыстары актісінің нысаны',
    language: 'kz',
    fields: [
        { tag: 'approval_date', label: 'Бекіту күні', type: 'date' },
        { tag: 'approval_protocol_number', label: 'Хаттама нөмірі', type: 'text' },
        { tag: 'act_address', label: 'Акті құрастырылған қала', type: 'text' },
        { tag: 'act_date', label: 'Актінің құрастырылған күні', type: 'date' },
        { tag: 'commission_order_details', label: 'Комиссияны тағайындаған орган', type: 'text' },
        { tag: 'commission_order_date', label: 'Шешім/бұйрық күні', type: 'date' },
        { tag: 'chairman_fio', label: 'Төрағаның Аты-жөні', type: 'text' },
        { tag: 'chairman_position', label: 'Төрағаның лауазымы', type: 'text' },
        { tag: 'commission_members_list', label: 'Комиссия мүшелері - өкілдері', type: 'textarea' },
        { tag: 'contractor_fio', label: 'Мердігердің Аты-жөні', type: 'text' },
        { tag: 'contractor_position', label: 'Мердігердің лауазымы', type: 'text' },
        { tag: 'tech_supervision_fio', label: 'Құрылыс бақылау өкілінің Аты-жөні', type: 'text' },
        { tag: 'tech_supervision_position', label: 'Құрылыс бақылау өкілінің лауазымы', type: 'text' },
        { tag: 'design_org_fio', label: 'Жобалау ұйымы өкілінің Аты-жөні', type: 'text' },
        { tag: 'design_org_position', label: 'Жобалау ұйымы өкілінің лауазымы', type: 'text' },
        { tag: 'performer_fio', label: 'Орындаушының Аты-жөні', type: 'text' },
        { tag: 'performer_position', label: 'Орындаушының лауазымы', type: 'text' },
        { tag: 'local_gov_fio', label: 'Жергілікті өзін-өзі басқару өкілінің Аты-жөні', type: 'text' },
        { tag: 'local_gov_position', label: 'Жергілікті өзін-өзі басқару өкілінің лауазымы', type: 'text' },
        { tag: 'presented_property_address', label: 'Ұсынылған мүліктің мекенжайы', type: 'text' },
        { tag: 'design_estimate_developer', label: 'Жобалау-сметалық құжаттаманы əзірлеген', type: 'text' },
        { tag: 'design_estimate_approver', label: 'Жобалау-сметалық құжаттаманы бекіткен', type: 'text' },
        { tag: 'design_estimate_protocol_num', label: 'Бекіту хаттамасының нөмірі', type: 'text' },
        { tag: 'design_estimate_approval_date', label: 'Бекіту күні', type: 'date' },
        { tag: 'repair_contractor_details', label: 'Жөндеуді жүзеге асырған мердігер', type: 'textarea' },
        { tag: 'instrumental_check_date', label: 'Құралдық тексеру күні', type: 'date' },
        { tag: 'instrumental_check_org', label: 'Құралдық тексеруді жүргізген ұйым', type: 'text' },
        { tag: 'scheduled_start_date', label: 'Жұмыстарды бастаудың жоспарлы күні', type: 'date' },
        { tag: 'actual_start_date', label: 'Жұмыстарды бастаудың нақты күні', type: 'date' },
        { tag: 'scheduled_end_date', label: 'Жұмыстарды аяқтаудың жоспарлы күні', type: 'date' },
        { tag: 'actual_end_date', label: 'Жұмыстарды аяқтаудың нақты күні', type: 'date' },
        { tag: 'submitted_docs_description', label: 'Ұсынылған құжаттаманың сипаттамасы', type: 'textarea' },
        { tag: 'architectural_solutions_description', label: 'Сəулет-құрылыс шешімдерінің сипаттамасы', type: 'textarea' },
        { tag: 'defects_appendix_number', label: 'Ақаулар қосымшасының нөмірі', type: 'text' },
        { tag: 'defects_deadline', label: 'Ақауларды жою мерзімі', type: 'text' },
        { tag: 'estimated_works_cost', label: 'Смета бойынша жұмыстардың құны (т.т.)', type: 'number' },
        { tag: 'actual_works_cost', label: 'Іс жүзіндегі жұмыстардың құны (т.т.)', type: 'number' },
        { tag: 'quality_grade', label: 'Орындалған жұмыстардың сапа бағасы', type: 'text' },
        { tag: 'final_repair_parameters', label: 'Жөндеудің қорытынды көрсеткіштері', type: 'textarea' },
        { tag: 'energy_efficiency_class', label: 'Энергия тиімділігі класы', type: 'text' },
        { tag: 'sustainability_rating', label: 'Тіршілік ету ортасының орнықтылық рейтингі', type: 'text' },
        { tag: 'post_repair_condition_summary', label: 'Жөндеуден кейінгі жай-күй сипаттамасы', type: 'textarea' },
        { tag: 'property_for_acceptance_address', label: 'Қабылдауға ұсынылған мүліктің мекенжайы', type: 'text' },
        { tag: 'final_act_creation_date', label: 'Қорытынды актінің құрастырылған күні', type: 'date' },
        { tag: 'final_appendix_number', label: 'Қорытынды қосымшаның нөмірі', type: 'text' },
        { tag: 'final_owners_meeting_address', label: 'Меншік иелерінің жиналысының мекенжайы', type: 'text' },
        { tag: 'final_meeting_date', label: 'Қорытынды жиналыс күні', type: 'date' },
        { tag: 'final_meeting_protocol_num', label: 'Қорытынды хаттама нөмірі', type: 'text' },
        { tag: 'chairman_signature_fio', label: 'Комиссия төрағасының қолтаңбасы үшін Аты-жөні', type: 'text' },
        {
            tag: 'commission_members',
            label: 'Комиссия мүшелері (қолтаңба үшін)',
            type: 'loop',
            subFields: [
                { tag: 'member_fio', label: 'Комиссия мүшесінің Аты-жөні', type: 'text' }
            ]
        }
    ]
},
    'tapsyrys-berushinin-zhumystardy-oryndau-kolemin-kezeildigin-nemese-olardyn-kunyn-bagasyn-ozgertu-faktisin-rastaityn-akt-nysany.docx': {
    name: 'Тапсырыс берушінің жұмыстарды орындау көлемін, кезеңділігін немесе олардың құнын (бағасын) өзгерту фактісін растайтын акт нысаны',
    language: 'kz',
    fields: [
        { tag: 'change_description', label: 'Өзгерістердің сипаттамасы', type: 'textarea' },
        { tag: 'property_address', label: 'Объектінің мекенжайы', type: 'text' },
        { tag: 'decision_making_body', label: 'Шешім қабылдаған орган', type: 'text' },
        { tag: 'customer_rep_fio', label: 'Тапсырыс берушінің өкілінің Аты-жөні', type: 'text' },
        { tag: 'customer_rep_position', label: 'Тапсырыс берушінің өкілінің лауазымы', type: 'text' },
        { tag: 'performer_rep_fio', label: 'Орындаушының өкілінің Аты-жөні', type: 'text' },
        { tag: 'performer_rep_position', label: 'Орындаушының өкілінің лауазымы', type: 'text' },
        { 
            tag: 'work_items', 
            label: 'Жұмыстар', 
            type: 'loop', 
            subFields: [
                { tag: 'index', label: '№', type: 'number' },
                { tag: 'work_name', label: 'Жұмыстың атауы', type: 'text' },
                { tag: 'standard_cost', label: 'ҚР СТ 2970 сәйкес анықталған жұмыстар құны', type: 'number' },
                { tag: 'cost_calculation_schedule', label: 'Жұмыстардың құнын есептеу негізінде орындау кестесі', type: 'text' },
                { tag: 'change_justification', label: 'Жұмыс құнының өзгеруінің негіздемесі', type: 'textarea' },
                { tag: 'new_work_cost', label: 'Тапсырыс беруші оны өзгерткеннен кейін жұмыстың құны', type: 'number' },
                { tag: 'new_schedule_cost', label: 'Тапсырыс беруші өзгерткеннен кейін жұмыстарды орындау кестесі жұмыс құны', type: 'number' }
            ]
        },
        { tag: 'change_consequences', label: 'Өзгерістердің салдары', type: 'textarea' },
        { tag: 'performer_date', label: 'Орындаушы қол қойған күн', type: 'date' },
        { tag: 'customer_date', label: 'Тапсырыс беруші қол қойған күн', type: 'date' },
    ]
}
};