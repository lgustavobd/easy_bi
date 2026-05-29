import { Injectable } from '@nestjs/common';

/**
 * Tipos locais usados pelo analisador para evitar dependência direta
 * dos enums gerados pelo Prisma Client durante a compilação em watch mode.
 *
 * Os valores abaixo continuam compatíveis com os enums definidos no schema.prisma:
 * DataType e SemanticType.
 */
type DataType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'CURRENCY' | 'PERCENTAGE';
type SemanticType =
  | 'METRIC'
  | 'DIMENSION'
  | 'TIME_DIMENSION'
  | 'FINANCIAL_METRIC'
  | 'CATEGORY'
  | 'IDENTIFIER'
  | 'DESCRIPTION';

@Injectable()
export class ColumnAnalyzerService {
  analyze(rows: Record<string, any>[]) {
    const sample = rows.slice(0, 200);
    return Object.keys(sample[0] || {}).map((column) => {
      const values = sample.map(r => r[column]).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
      const uniqueCount = new Set(values.map(v => String(v))).size;
      const dataType = this.detectDataType(column, values);
      const semanticType = this.detectSemanticType(column, dataType, uniqueCount, values.length);
      return {
        name: this.normalize(column),
        originalName: column,
        dataType,
        semanticType,
        isMetric: ['METRIC', 'FINANCIAL_METRIC'].includes(semanticType),
        isDimension: ['DIMENSION', 'TIME_DIMENSION', 'CATEGORY'].includes(semanticType),
        isIdentifier: semanticType === 'IDENTIFIER',
        isNullable: values.length < sample.length,
        uniqueCount,
        sampleValues: values.slice(0, 8),
        confidence: this.confidence(dataType, semanticType, values.length, sample.length)
      };
    });
  }

  private detectDataType(column: string, values: any[]): DataType {
    const name = column.toLowerCase();
    if (!values.length) return 'TEXT';
    const strings = values.map(v => String(v).trim());
    const numberRate = strings.filter(v => this.isNumber(v)).length / values.length;
    const dateRate = strings.filter(v => this.isDate(v)).length / values.length;
    const boolRate = strings.filter(v => /^(true|false|sim|não|nao|yes|no|0|1)$/i.test(v)).length / values.length;
    if (/(percent|%|taxa|margem|indice|índice)/i.test(name) || strings.filter(v => v.includes('%')).length / values.length > 0.5) return 'PERCENTAGE';
    if (/(valor|preco|preço|custo|receita|faturamento|saldo|total|amount|price)/i.test(name) && numberRate > 0.7) return 'CURRENCY';
    if (dateRate > 0.75) return 'DATE';
    if (boolRate > 0.85) return 'BOOLEAN';
    if (numberRate > 0.8) return 'NUMBER';
    return 'TEXT';
  }

  private detectSemanticType(column: string, type: DataType, unique: number, count: number): SemanticType {
    const name = column.toLowerCase();
    if (/(^id$|_id$|codigo|código|cod|cpf|cnpj|email|uuid|chave)/i.test(name)) return 'IDENTIFIER';
    if (/(descricao|descrição|observacao|observação|detalhe|comentario|comentário)/i.test(name)) return 'DESCRIPTION';
    if (type === 'DATE') return 'TIME_DIMENSION';
    if (type === 'CURRENCY') return 'FINANCIAL_METRIC';
    if (type === 'NUMBER' || type === 'PERCENTAGE') return 'METRIC';
    if (unique <= Math.max(20, count * 0.25)) return 'CATEGORY';
    return 'DIMENSION';
  }

  private isNumber(value: string) {
    const n = value.replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.').replace('%', '');
    return n !== '' && !Number.isNaN(Number(n));
  }

  private isDate(value: string) {
    return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value) || (!Number.isNaN(Date.parse(value)) && /\d/.test(value));
  }

  private normalize(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
  }

  private confidence(type: DataType, semantic: SemanticType, valid: number, total: number) {
    const completeness = total === 0 ? 0 : valid / total;
    const typeScore = ['NUMBER', 'DATE', 'CURRENCY', 'PERCENTAGE'].includes(type) ? 0.9 : 0.75;
    const semanticScore = ['METRIC', 'FINANCIAL_METRIC', 'TIME_DIMENSION', 'CATEGORY'].includes(semantic) ? 0.9 : 0.7;
    return Number(((completeness + typeScore + semanticScore) / 3).toFixed(2));
  }
}
