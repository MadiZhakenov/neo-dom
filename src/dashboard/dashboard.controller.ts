import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  @Get()
  getDashboardData() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    return {
      events: [
        // Октябрь (текущий месяц) - реалистичные события для конца октября
        { id: 1, date: new Date(currentYear, currentMonth, 25), title: 'Подготовка системы отопления к зиме', type: 'maintenance' },
        { id: 2, date: new Date(currentYear, currentMonth, 25), title: 'Уборка опавшей листвы', type: 'maintenance' },
        { id: 3, date: new Date(currentYear, currentMonth, 25), title: 'Собрание по подготовке к отопительному сезону', type: 'meeting' },
        
        { id: 4, date: new Date(currentYear, currentMonth, 26), title: 'Замена ламп в подъезде №1', type: 'repair' },
        { id: 5, date: new Date(currentYear, currentMonth, 26), title: 'Проверка пожарной сигнализации', type: 'maintenance' },
        
        { id: 6, date: new Date(currentYear, currentMonth, 27), title: 'Плановая проверка пожарной сигнализации', type: 'maintenance' },
        { id: 7, date: new Date(currentYear, currentMonth, 27), title: 'Ремонт лифта в подъезде №2', type: 'repair' },
        { id: 8, date: new Date(currentYear, currentMonth, 27), title: 'Встреча с управляющей компанией', type: 'meeting' },
        
        { id: 9, date: new Date(currentYear, currentMonth, 28), title: 'Отключение воды на технические работы', type: 'maintenance' },
        { id: 10, date: new Date(currentYear, currentMonth, 28), title: 'Установка новых почтовых ящиков', type: 'repair' },
        
        { id: 11, date: new Date(currentYear, currentMonth, 29), title: 'Проверка системы вентиляции', type: 'maintenance' },
        { id: 12, date: new Date(currentYear, currentMonth, 29), title: 'Замена ламп в подъездах', type: 'repair' },
        { id: 13, date: new Date(currentYear, currentMonth, 29), title: 'Осенний субботник', type: 'event' },
        
        { id: 14, date: new Date(currentYear, currentMonth, 30), title: 'Ремонт детской площадки', type: 'repair' },
        { id: 15, date: new Date(currentYear, currentMonth, 30), title: 'Проверка газового оборудования', type: 'maintenance' },
        { id: 16, date: new Date(currentYear, currentMonth, 30), title: 'Подготовка к Хэллоуину', type: 'event' },
        
        { id: 17, date: new Date(currentYear, currentMonth, 31), title: 'Уборка подвальных помещений', type: 'maintenance' },
        { id: 18, date: new Date(currentYear, currentMonth, 31), title: 'Замена замков в подъездах', type: 'repair' },
        { id: 19, date: new Date(currentYear, currentMonth, 31), title: 'Хэллоуин для детей', type: 'event' },
    
        // Ноябрь (следующий месяц) - реалистичные события
        { id: 20, date: new Date(currentYear, currentMonth + 1, 1), title: 'Начало отопительного сезона', type: 'maintenance' },
        { id: 21, date: new Date(currentYear, currentMonth + 1, 1), title: 'Проверка системы отопления', type: 'maintenance' },
        
        { id: 22, date: new Date(currentYear, currentMonth + 1, 2), title: 'Утепление окон в подъездах', type: 'repair' },
        { id: 23, date: new Date(currentYear, currentMonth + 1, 2), title: 'Подготовка к зиме', type: 'maintenance' },
        
        { id: 24, date: new Date(currentYear, currentMonth + 1, 3), title: 'Встреча с представителями ЖКХ', type: 'meeting' },
        { id: 25, date: new Date(currentYear, currentMonth + 1, 3), title: 'Установка новых почтовых ящиков', type: 'repair' },
        { id: 26, date: new Date(currentYear, currentMonth + 1, 3), title: 'Осенний субботник', type: 'event' },
        
        { id: 27, date: new Date(currentYear, currentMonth + 1, 4), title: 'Проверка электросчетчиков', type: 'maintenance' },
        { id: 28, date: new Date(currentYear, currentMonth + 1, 4), title: 'Ремонт системы видеонаблюдения', type: 'repair' },
        
        { id: 29, date: new Date(currentYear, currentMonth + 1, 5), title: 'Плановое собрание жильцов', type: 'meeting' },
        { id: 30, date: new Date(currentYear, currentMonth + 1, 5), title: 'Подготовка подвалов к зиме', type: 'maintenance' },
        { id: 31, date: new Date(currentYear, currentMonth + 1, 5), title: 'Утепление входных дверей', type: 'repair' },
    
        { id: 32, date: new Date(currentYear, currentMonth + 1, 6), title: 'Проверка системы отопления', type: 'maintenance' },
        { id: 33, date: new Date(currentYear, currentMonth + 1, 6), title: 'Ремонт крыльца', type: 'repair' },
        
        { id: 34, date: new Date(currentYear, currentMonth + 1, 7), title: 'День народного единства - праздничные мероприятия', type: 'event' },
        { id: 35, date: new Date(currentYear, currentMonth + 1, 7), title: 'Уборка территории после праздника', type: 'maintenance' },
        
        { id: 36, date: new Date(currentYear, currentMonth + 1, 8), title: 'Проверка противопожарных систем', type: 'maintenance' },
        { id: 37, date: new Date(currentYear, currentMonth + 1, 8), title: 'Замена труб в подвале', type: 'repair' },
        
        { id: 38, date: new Date(currentYear, currentMonth + 1, 9), title: 'Встреча с управляющей компанией', type: 'meeting' },
        { id: 39, date: new Date(currentYear, currentMonth + 1, 9), title: 'Уборка чердачных помещений', type: 'maintenance' },
        { id: 40, date: new Date(currentYear, currentMonth + 1, 9), title: 'Ремонт системы вентиляции', type: 'repair' },
        
        { id: 41, date: new Date(currentYear, currentMonth + 1, 10), title: 'Общее собрание жильцов', type: 'meeting' },
        { id: 42, date: new Date(currentYear, currentMonth + 1, 10), title: 'Проверка пожарных гидрантов', type: 'maintenance' },
        { id: 43, date: new Date(currentYear, currentMonth + 1, 10), title: 'Установка новых скамеек', type: 'repair' },
        
        { id: 44, date: new Date(currentYear, currentMonth + 1, 11), title: 'Подготовка к зиме', type: 'maintenance' },
        { id: 45, date: new Date(currentYear, currentMonth + 1, 11), title: 'Ремонт детской площадки', type: 'repair' },
        
        { id: 46, date: new Date(currentYear, currentMonth + 1, 12), title: 'Проверка системы водоснабжения', type: 'maintenance' },
        { id: 47, date: new Date(currentYear, currentMonth + 1, 12), title: 'Замена освещения во дворе', type: 'repair' },
        { id: 48, date: new Date(currentYear, currentMonth + 1, 12), title: 'Собрание по благоустройству', type: 'meeting' },
        
        { id: 49, date: new Date(currentYear, currentMonth + 1, 13), title: 'Уборка территории', type: 'maintenance' },
        { id: 50, date: new Date(currentYear, currentMonth + 1, 13), title: 'Ремонт крыльца подъезда №2', type: 'repair' },
        
        { id: 51, date: new Date(currentYear, currentMonth + 1, 14), title: 'Осенний праздник для детей', type: 'event' },
        { id: 52, date: new Date(currentYear, currentMonth + 1, 14), title: 'Проверка газового оборудования', type: 'maintenance' },
        { id: 53, date: new Date(currentYear, currentMonth + 1, 14), title: 'Установка новых качелей', type: 'repair' },
        
        { id: 54, date: new Date(currentYear, currentMonth + 1, 15), title: 'Уборка подвальных помещений', type: 'maintenance' },
        { id: 55, date: new Date(currentYear, currentMonth + 1, 15), title: 'Замена замков в подъездах', type: 'repair' },
        
        { id: 56, date: new Date(currentYear, currentMonth + 1, 16), title: 'Собрание совета дома', type: 'meeting' },
        { id: 57, date: new Date(currentYear, currentMonth + 1, 16), title: 'Подготовка к морозам', type: 'maintenance' },
        { id: 58, date: new Date(currentYear, currentMonth + 1, 16), title: 'Ремонт системы отопления', type: 'repair' },
    
        // Сентябрь (прошлый месяц) - для контекста
        { id: 59, date: new Date(currentYear, currentMonth - 1, 15), title: 'Подготовка к отопительному сезону', type: 'maintenance' },
        { id: 60, date: new Date(currentYear, currentMonth - 1, 15), title: 'Ремонт лифта', type: 'repair' },
        
        { id: 61, date: new Date(currentYear, currentMonth - 1, 20), title: 'Собрание жильцов', type: 'meeting' },
        { id: 62, date: new Date(currentYear, currentMonth - 1, 20), title: 'Уборка территории', type: 'maintenance' },
        
        { id: 63, date: new Date(currentYear, currentMonth - 1, 25), title: 'Ремонт детской площадки', type: 'repair' },
        { id: 64, date: new Date(currentYear, currentMonth - 1, 25), title: 'Осенний праздник', type: 'event' },
      ],
      announcements: [
        { id: 1, text: '28.10.2025: Начинается плановый ремонт кровли подъезда №2.' },
        { id: 2, text: '25.10.2025: Просьба убрать личные вещи с лестничных площадок в связи с предстоящей уборкой.' },
        { id: 3, text: '22.10.2025: Внимание! 30 октября будет проводиться опрессовка системы отопления.' },
        { id: 4, text: '20.10.2025: Уважаемые жильцы, просим своевременно оплачивать коммунальные услуги.' },
        { id: 5, text: '18.10.2025: Завершен ремонт детской площадки. Спасибо за терпение!' },
        { id: 6, text: '15.10.2025: Напоминаем о необходимости соблюдать тишину в ночное время с 22:00 до 09:00.' },
        { id: 7, text: '12.10.2025: Будет проводиться дезинсекция подвальных помещений.' },
        { id: 8, text: '10.10.2025: Отчет о расходах за сентябрь 2025 года размещен на информационном стенде.' },
        { id: 9, text: '08.10.2025: Найдены ключи от квартиры №72. Обращаться к консьержу.' },
        { id: 10, text: '05.10.2025: Проводится сбор средств на установку системы видеонаблюдения.' },
        
        // Новые объявления (еще больше)
        { id: 11, text: '03.10.2025: Внимание! Завтра плановое отключение электроэнергии с 10:00 до 12:00.' },
        { id: 12, text: '01.10.2025: Напоминаем о необходимости подготовить балконы к зимнему сезону.' },
        { id: 13, text: '29.09.2025: Установлены новые контейнеры для раздельного сбора мусора.' },
        { id: 14, text: '27.09.2025: Просьба не парковать автомобили у въезда во двор.' },
        { id: 15, text: '25.09.2025: Начался прием заявок на ремонт квартир от управляющей компании.' },
        { id: 16, text: '23.09.2025: Обновлен список контактов аварийных служб.' },
        { id: 17, text: '21.09.2025: В подъезде №4 заменены все лампы на энергосберегающие.' },
        { id: 18, text: '19.09.2025: На территории двора установлены новые скамейки.' },
        { id: 19, text: '17.09.2025: Просим сообщать о неисправностях в системе отопления.' },
        { id: 20, text: '15.09.2025: Составлен график дежурств по уборке подъездов.' },
        { id: 21, text: '13.09.2025: Внимание! Изменился график работы консьержа.' },
        { id: 22, text: '11.09.2025: Проведена дератизация подвальных помещений.' },
        { id: 23, text: '09.09.2025: Установлены новые домофоны в подъездах №1 и №3.' },
        { id: 24, text: '07.09.2025: Напоминаем о правилах пользования лифтом.' },
        { id: 25, text: '05.09.2025: Объявлен конкурс на лучшее оформление балкона.' },
        { id: 26, text: '03.09.2025: Просьба не выбрасывать крупногабаритный мусор в контейнеры.' },
        { id: 27, text: '01.09.2025: С началом учебного года! Просим быть внимательнее к детям на дороге.' }
      ],
    };
  }
}