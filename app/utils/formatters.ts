// app/utils/formatters.ts

export function formatOrgName(fullName: string): { form: string, name: string } {
    if (!fullName || fullName === '---') return { form: '', name: '---' };

    let form = '';
    let name = fullName.trim();

    const forms: Record<string, string> = {
        'общество с ограниченной ответственностью': 'ООО',
        'индивидуальный предприниматель': 'ИП',
        'акционерное общество': 'АО',
        'публичное акционерное общество': 'ПАО',
        'закрытое акционерное общество': 'ЗАО',
        'самозанятый': 'СЗ'
    };

    // 1. Ищем полное наименование и заменяем на аббревиатуру
    const lowerName = name.toLowerCase();
    for (const [full, short] of Object.entries(forms)) {
        if (lowerName.includes(full)) {
            form = short;
            name = name.replace(new RegExp(full, 'i'), '').trim();
            break;
        }
    }

    // 2. Если полного нет, ищем уже готовую аббревиатуру в начале строки (ООО "Ромашка")
    if (!form) {
        const shortForms = ['ООО', 'ИП', 'АО', 'ПАО', 'ЗАО', 'СЗ'];
        for (const sf of shortForms) {
            if (name.toUpperCase().startsWith(sf + ' ') || name.toUpperCase().startsWith(sf + '"')) {
                form = sf;
                name = name.substring(sf.length).trim();
                break;
            }
        }
    }

    // Очищаем от случайных запятых в начале
    name = name.replace(/^[, ]+/, '').trim();
    return { form, name };
}

export function formatItemCount(count: number): string {
    if (count >= 1000) {
        return (count / 1000).toFixed(1).replace('.0', '') + 'к п.';
    }
    return count + ' п.';
}
