import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';
import { ProductService } from '../services/service/product';
import { ResponseFromDigiflazz } from '../types/digiflazz';

interface TopUpRequest {
  userId: string;
  serverId?: string;
  reference : string
  productCode: string;
}

export class Digiflazz {
  private username: string;
  private apiKey: string;

  constructor(username: string, apiKey: string) {
    this.username = username;
    this.apiKey = apiKey;
  }

  async checkPrice(): Promise<ProductService[]> {
    try {
      const sign = crypto.createHash('md5').update(this.apiKey).digest('hex');

      const payload = {
        cmd: 'pricelist',
        username: this.username,
        sign: sign,
      };

      const response = await axios({
        method: 'POST',
        url: 'https://api.digiflazz.com/v1/price-list',
        headers: {
          'Content-Type': 'application/json',
        },
        data: payload,
      });

      return response.data.data;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Digiflazz price check error:', error.message);
      } else {
        console.error('Unknown error:', error);
      }
      throw error;
    }
  }

  async TopUp(topUpData: TopUpRequest) {
    try {

      const signature = crypto
        .createHash('md5')
        .update(this.username + this.apiKey + topUpData.reference)
        .digest('hex');

      const userId = topUpData.userId?.trim();
      const serverId = topUpData.serverId?.trim();
     
      let customerNo;

      if (userId && serverId) {
        customerNo = `${userId}${serverId}`;
      } else  {
        customerNo = userId;
      } 
      console.log(topUpData.productCode)
      const data = {
        username: this.username,
        buyer_sku_code: "CHECKIDS",
        customer_no: customerNo,
        ref_id: topUpData.reference,
        sign: signature,
        cb_url : process.env.DIGI_CALLBACK_URL
      };


      // Send request to Digiflazz API
      const response = await fetch('https://api.digiflazz.com/v1/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      
      
      
      const result: ResponseFromDigiflazz = await response.json()
      return result;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error making order:', error.message);
        throw error;
      }
    }
  }
  async checkPricePrepaid() {
    try {
      const sign = crypto.createHash('md5').update(this.apiKey).digest('hex');

      const payload = {
        cmd: 'pricelist',
        username: this.username,
        sign: sign,
      };

      const response = await axios({
        method: 'POST',
        url: 'https://api.digiflazz.com/v1/price-list',
        headers: {
          'Content-Type': 'application/json',
        },
        data: payload,
      });

      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Digiflazz price check error:', error.message);

        // Check if it's an Axios error with a response
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          if (axiosError.response) {
            console.error(
              'Response data:',
              JSON.stringify(axiosError.response.data)
            );
            console.error('Response status:', axiosError.response.status);
            console.error('Response headers:', axiosError.response.headers);
          } else if (axiosError.request) {
            console.error('No response received:', axiosError.request);
          } else {
            console.error('Error setting up request:', axiosError.message);
          }
          console.error('Error config:', axiosError.config);
        }
      } else {
        console.error('Unknown error:', error);
      }
      throw error;
    }
  }

  async CreateOrder(service = null, order_id = null, target: string) {
    try {
      const api = {
        username_digi: this.username,
        api_key_digi: this.apiKey,
      };
      const sign = crypto.createHash('md5').update(this.apiKey).digest('hex');
      const api_postdata = {
        username: api.username_digi,
        buyer_sku_code: service,
        customer_no: target,
        ref_id: String(order_id),
        sign: sign,
      };
      const headers = {
        'Content-Type': 'application/json',
      };

      const response = await axios.post(
        'https://api.digiflazz.com/v1/transaction',
        api_postdata,
        { headers }
      );
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error making order:', error.message);
        throw error;
      }
    }
  }

  async checkDeposit() {
    try {
    const sign = crypto
      .createHash('md5')
      .update(this.username + this.apiKey + "depo")
      .digest('hex');

    const payload = {
      cmd: 'deposit',
      username: this.username,
      sign: sign,
    };

    const response = await axios.post(
      'https://api.digiflazz.com/v1/cek-saldo',
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );
   
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return error
    } else {
      return error
    }
  }
  }
 
}