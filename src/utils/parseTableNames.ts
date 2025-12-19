function parseTableNames(response: string[]): string[] {
    return response
        .map(item => item.trim())
        .filter(item => {
            // Filter out header
            if (item === 'table_name') return false;
            
            // Filter out separator lines (all dashes)
            if (/^-+$/.test(item)) return false;
            
            // Filter out footer like "(2 rows)"
            if (/^\(\d+\s+rows?\)$/i.test(item)) return false;
            
            // Filter out empty strings
            if (item === '') return false;
            
            return true;
        });
}
export default parseTableNames